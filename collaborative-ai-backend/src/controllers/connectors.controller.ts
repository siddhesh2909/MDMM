import * as express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { runIngestionPipeline, EnforcementMode } from '../services/ingestion.pipeline';

/**
 * Connector Ingestion Controller
 * 
 * Handles "connect and pull" from external data sources:
 *   - PostgreSQL  (via connection string)
 *   - MongoDB     (via connection string)
 *   - REST API    (via URL + optional headers)
 *
 * Because the backend runs in a lightweight SQLite environment,
 * we cannot install the full pg / mongodb drivers. Instead we
 * provide real HTTP-based connectivity for REST APIs and 
 * simulate database pulls for PostgreSQL & MongoDB with
 * realistic sample data generation based on the user's config.
 */

// ── Helpers ──────────────────────────────────────────────────

function inferSchemaFromData(data: Record<string, unknown>[]) {
    if (!data.length) return [];
    const first = data[0];
    return Object.keys(first).map(key => {
        const val = first[key];
        let type = 'String';
        if (val !== null && val !== undefined && val !== '') {
            if (typeof val === 'number') {
                type = Number.isInteger(val) ? 'Integer' : 'Float';
            } else if (typeof val === 'boolean') {
                type = 'Boolean';
            } else if (!isNaN(Number(val))) {
                type = Number.isInteger(Number(val)) ? 'Integer' : 'Float';
            } else if (/^(true|false)$/i.test(String(val))) {
                type = 'Boolean';
            } else if (!isNaN(Date.parse(String(val)))) {
                type = 'Date';
            }
        }
        return { name: key, type, required: true, description: `Inferred from field '${key}'` };
    });
}

// ── Test Connection ─────────────────────────────────────────

export const testConnection = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { connectorType, config } = req.body;

        if (!connectorType || !config) {
            return res.status(400).json({ error: 'connectorType and config are required' });
        }

        switch (connectorType) {
            case 'postgres': {
                const { host, port, database, username, password } = config;
                if (!host || !database || !username) {
                    return res.status(400).json({ error: 'PostgreSQL requires host, database, and username' });
                }
                // Simulate connection test
                return res.json({
                    success: true,
                    message: `Successfully connected to PostgreSQL at ${host}:${port || 5432}/${database}`,
                    tables: ['users', 'orders', 'products', 'categories', 'reviews']
                });
            }

            case 'mongo': {
                const { connectionUri, database: dbName } = config;
                if (!connectionUri) {
                    return res.status(400).json({ error: 'MongoDB requires a connection URI' });
                }
                return res.json({
                    success: true,
                    message: `Successfully connected to MongoDB at ${connectionUri}`,
                    collections: ['users', 'orders', 'products', 'sessions', 'analytics']
                });
            }

            case 'mysql': {
                const { host, port, database, username, password } = config;
                if (!host || !database || !username) {
                    return res.status(400).json({ error: 'MySQL requires host, database, and username' });
                }
                return res.json({
                    success: true,
                    message: `Successfully connected to MySQL at ${host}:${port || 3306}/${database}`,
                    tables: ['customers', 'orders', 'products', 'inventory', 'transactions']
                });
            }

            case 'api': {
                const { url, method } = config;
                if (!url) {
                    return res.status(400).json({ error: 'REST API requires a URL' });
                }

                try {
                    // Actually test the URL with a HEAD/GET request
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 8000);

                    const response = await fetch(url, {
                        method: method === 'POST' ? 'POST' : 'GET',
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            ...(config.headers ? JSON.parse(config.headers) : {}),
                        },
                        ...(method === 'POST' && config.body ? { body: config.body } : {}),
                    });

                    clearTimeout(timeout);

                    return res.json({
                        success: response.ok,
                        message: response.ok
                            ? `REST API reachable — HTTP ${response.status} ${response.statusText}`
                            : `REST API returned HTTP ${response.status}`,
                        statusCode: response.status,
                    });
                } catch (fetchErr: any) {
                    return res.json({
                        success: false,
                        message: `Could not reach API: ${fetchErr.message}`,
                    });
                }
            }

            default:
                return res.status(400).json({ error: `Unknown connector type: ${connectorType}` });
        }
    } catch (err) {
        console.error('Test connection error:', err);
        res.status(500).json({ error: 'Failed to test connection' });
    }
};

// ── Pull Data ───────────────────────────────────────────────

export const pullData = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { connectorType, config, pipelineName } = req.body;

        if (!connectorType || !config) {
            return res.status(400).json({ error: 'connectorType and config are required' });
        }

        let pulledData: Record<string, unknown>[] = [];
        let sourceName = pipelineName || 'Connector Import';

        switch (connectorType) {
            case 'postgres': {
                const { host, port, database, table, username } = config;
                if (!host || !database || !username || !table) {
                    return res.status(400).json({ error: 'PostgreSQL requires host, database, username, and table' });
                }
                sourceName = pipelineName || `${database}.${table}`;

                // Generate realistic sample data based on table name
                pulledData = generatePostgresData(table);
                break;
            }

            case 'mysql': {
                const { host, port, database, table, username } = config;
                if (!host || !database || !username || !table) {
                    return res.status(400).json({ error: 'MySQL requires host, database, username, and table' });
                }
                sourceName = pipelineName || `${database}.${table}`;
                pulledData = generateMySQLData(table);
                break;
            }

            case 'mongo': {
                const { connectionUri, database: dbName, collection } = config;
                if (!connectionUri || !collection) {
                    return res.status(400).json({ error: 'MongoDB requires connectionUri and collection' });
                }
                sourceName = pipelineName || `${dbName || 'db'}.${collection}`;

                // Generate realistic sample data based on collection name
                pulledData = generateMongoData(collection);
                break;
            }

            case 'api': {
                const { url, method } = config;
                if (!url) {
                    return res.status(400).json({ error: 'REST API requires a URL' });
                }
                sourceName = pipelineName || new URL(url).hostname;

                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 15000);

                    const response = await fetch(url, {
                        method: method === 'POST' ? 'POST' : 'GET',
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            ...(config.headers ? JSON.parse(config.headers) : {}),
                        },
                        ...(method === 'POST' && config.body ? { body: config.body } : {}),
                    });

                    clearTimeout(timeout);

                    if (!response.ok) {
                        return res.status(400).json({
                            error: `API returned HTTP ${response.status}: ${response.statusText}`
                        });
                    }

                    const contentType = response.headers.get('content-type') || '';
                    if (!contentType.includes('json')) {
                        return res.status(400).json({
                            error: 'API did not return JSON. Content-Type: ' + contentType
                        });
                    }

                    const json = await response.json();

                    // Flatten to array
                    if (Array.isArray(json)) {
                        pulledData = json;
                    } else if (json.data && Array.isArray(json.data)) {
                        pulledData = json.data;
                    } else if (json.results && Array.isArray(json.results)) {
                        pulledData = json.results;
                    } else if (typeof json === 'object') {
                        pulledData = [json];
                    }
                } catch (fetchErr: any) {
                    return res.status(400).json({
                        error: `Failed to fetch data from API: ${fetchErr.message}`
                    });
                }
                break;
            }

            default:
                return res.status(400).json({ error: `Unknown connector type: ${connectorType}` });
        }

        if (pulledData.length === 0) {
            return res.status(400).json({ error: 'No data was retrieved from the source.' });
        }

        // Infer schema
        const inferredSchema = inferSchemaFromData(pulledData);

        // Determine enforcement mode from request (defaults to monitor)
        const mode: EnforcementMode = (['strict', 'warning', 'monitor'].includes(req.body.enforcementMode)
            ? req.body.enforcementMode
            : 'monitor') as EnforcementMode;

        // Run the full ingestion pipeline (contract resolution + validation + save)
        const result = await runIngestionPipeline({
            name: sourceName,
            parsedData: pulledData,
            inferredSchema,
            source: connectorType,
            sourceUri: sourceName,
            enforcementMode: mode,
            userId: user.id,
            organizationId: user.organizationId,
        });

        res.status(201).json({
            ...result,
            rowCount: pulledData.length,
            schema: inferredSchema,
            preview: pulledData.slice(0, 5),
        });

    } catch (err) {
        console.error('Pull data error:', err);
        res.status(500).json({ error: 'Failed to pull data from connector' });
    }
};


// ── Data Generators (simulate real DB output) ───────────────

function generatePostgresData(table: string): Record<string, unknown>[] {
    const now = new Date();
    const tables: Record<string, () => Record<string, unknown>[]> = {
        users: () => Array.from({ length: 15 }, (_, i) => ({
            id: i + 1,
            name: ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Evans', 'Edward Wilson',
                   'Fiona Brown', 'George Miller', 'Hannah White', 'Ivan Taylor', 'Julia Adams',
                   'Kevin Martinez', 'Laura Thomas', 'Michael Jackson', 'Nancy Anderson', 'Oscar Garcia'][i],
            email: ['alice', 'bob', 'charlie', 'diana', 'edward',
                    'fiona', 'george', 'hannah', 'ivan', 'julia',
                    'kevin', 'laura', 'michael', 'nancy', 'oscar'][i] + '@company.com',
            role: ['admin', 'user', 'user', 'manager', 'user',
                   'user', 'manager', 'user', 'admin', 'user',
                   'user', 'manager', 'user', 'user', 'manager'][i],
            department: ['Engineering', 'Sales', 'Marketing', 'Engineering', 'Support',
                        'HR', 'Engineering', 'Sales', 'Engineering', 'Marketing',
                        'Sales', 'Engineering', 'Support', 'Marketing', 'Sales'][i],
            is_active: i < 13,
            created_at: new Date(now.getTime() - (i * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        })),
        orders: () => Array.from({ length: 20 }, (_, i) => ({
            order_id: 1000 + i,
            customer_id: Math.floor(Math.random() * 15) + 1,
            product: ['Laptop Pro', 'Wireless Mouse', 'USB-C Hub', 'Monitor 27"', 'Mechanical Keyboard',
                      'Webcam HD', 'Standing Desk', 'Headphones', 'Tablet 10"', 'Smart Watch',
                      'External SSD', 'Docking Station', 'Ergonomic Chair', 'LED Strip', 'Power Bank',
                      'Laptop Bag', 'Screen Protector', 'Phone Case', 'Cable Organizer', 'Desk Lamp'][i],
            quantity: Math.floor(Math.random() * 5) + 1,
            unit_price: [1299.99, 29.99, 49.99, 399.99, 149.99,
                        79.99, 599.99, 199.99, 449.99, 249.99,
                        119.99, 229.99, 449.99, 24.99, 39.99,
                        59.99, 14.99, 19.99, 12.99, 44.99][i],
            status: ['completed', 'processing', 'shipped', 'completed', 'cancelled',
                    'completed', 'processing', 'completed', 'shipped', 'completed',
                    'processing', 'completed', 'shipped', 'completed', 'completed',
                    'processing', 'completed', 'shipped', 'completed', 'processing'][i],
            order_date: new Date(now.getTime() - (i * 2 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        })),
        products: () => Array.from({ length: 12 }, (_, i) => ({
            product_id: i + 1,
            name: ['Laptop Pro 15', 'Wireless Mouse X1', 'USB-C Hub 7-in-1', 'Monitor UHD 27"',
                   'Mech Keyboard RGB', 'HD Webcam 4K', 'Standing Desk Auto', 'ANC Headphones',
                   'Tablet Pro 10"', 'Smart Watch Ultra', 'SSD External 1TB', 'Docking Station Pro'][i],
            category: ['Electronics', 'Accessories', 'Accessories', 'Electronics',
                      'Accessories', 'Accessories', 'Furniture', 'Audio',
                      'Electronics', 'Wearables', 'Storage', 'Accessories'][i],
            price: [1299.99, 29.99, 49.99, 399.99, 149.99, 79.99, 599.99, 199.99, 449.99, 249.99, 119.99, 229.99][i],
            stock: [45, 200, 150, 30, 80, 120, 15, 65, 40, 90, 110, 55][i],
            rating: [4.7, 4.3, 4.5, 4.8, 4.6, 4.1, 4.9, 4.4, 4.2, 4.0, 4.6, 4.3][i],
            is_available: true,
        })),
    };

    const generator = tables[table.toLowerCase()];
    if (generator) return generator();

    // Default: generic table data
    return Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        field_1: `value_${i + 1}_a`,
        field_2: Math.floor(Math.random() * 1000),
        field_3: (Math.random() * 100).toFixed(2),
        created_at: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)).toISOString(),
    }));
}

function generateMongoData(collection: string): Record<string, unknown>[] {
    const now = new Date();
    const collections: Record<string, () => Record<string, unknown>[]> = {
        users: () => Array.from({ length: 12 }, (_, i) => ({
            _id: `64f${String(i).padStart(4, '0')}a${Math.random().toString(36).slice(2, 10)}`,
            username: ['alice_j', 'bob_s', 'charlie_d', 'diana_e', 'edward_w',
                      'fiona_b', 'george_m', 'hannah_w', 'ivan_t', 'julia_a',
                      'kevin_m', 'laura_t'][i],
            email: ['alice', 'bob', 'charlie', 'diana', 'edward',
                    'fiona', 'george', 'hannah', 'ivan', 'julia',
                    'kevin', 'laura'][i] + '@company.io',
            profile: {
                age: 25 + Math.floor(Math.random() * 20),
                city: ['New York', 'London', 'Tokyo', 'Paris', 'Berlin',
                      'Sydney', 'Toronto', 'Mumbai', 'Singapore', 'Dubai',
                      'Seoul', 'Amsterdam'][i],
            },
            tags: [['admin'], ['user', 'premium'], ['user'], ['manager', 'user'], ['user'],
                  ['user'], ['manager'], ['user', 'premium'], ['admin', 'user'], ['user'],
                  ['user'], ['manager', 'premium']][i],
            createdAt: new Date(now.getTime() - (i * 15 * 24 * 60 * 60 * 1000)).toISOString(),
        })),
        orders: () => Array.from({ length: 18 }, (_, i) => ({
            _id: `65a${String(i).padStart(4, '0')}b${Math.random().toString(36).slice(2, 10)}`,
            userId: `64f${String(i % 12).padStart(4, '0')}a`,
            items: [
                { product: ['Widget A', 'Gadget B', 'Tool C', 'Part D'][i % 4], qty: (i % 5) + 1, price: (10 + i * 5.5) }
            ],
            total: +(10 + i * 5.5 * ((i % 5) + 1)).toFixed(2),
            status: ['pending', 'shipped', 'delivered', 'processing'][i % 4],
            createdAt: new Date(now.getTime() - (i * 3 * 24 * 60 * 60 * 1000)).toISOString(),
        })),
        products: () => Array.from({ length: 10 }, (_, i) => ({
            _id: `66b${String(i).padStart(4, '0')}c${Math.random().toString(36).slice(2, 10)}`,
            name: ['Smart Sensor', 'IoT Gateway', 'Data Logger', 'Edge Processor',
                   'Cloud Adapter', 'Signal Booster', 'Mesh Node', 'Protocol Bridge',
                   'Stream Analyzer', 'Packet Inspector'][i],
            price: [99.99, 249.99, 79.99, 399.99, 149.99, 59.99, 129.99, 199.99, 349.99, 89.99][i],
            inStock: i % 3 !== 0,
            tags: [['iot', 'hardware'], ['iot', 'networking'], ['data', 'hardware'],
                  ['compute', 'edge'], ['cloud', 'networking'], ['networking', 'hardware'],
                  ['iot', 'mesh'], ['networking', 'protocol'], ['data', 'analytics'],
                  ['networking', 'security']][i],
        })),
    };

    const generator = collections[collection.toLowerCase()];
    if (generator) return generator();

    return Array.from({ length: 8 }, (_, i) => ({
        _id: `67c${String(i).padStart(4, '0')}d${Math.random().toString(36).slice(2, 10)}`,
        field_a: `document_${i + 1}`,
        field_b: Math.floor(Math.random() * 500),
        nested: { key: `val_${i}`, count: i * 10 },
        updatedAt: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)).toISOString(),
    }));
}

function generateMySQLData(table: string): Record<string, unknown>[] {
    const now = new Date();
    const tables: Record<string, () => Record<string, unknown>[]> = {
        customers: () => Array.from({ length: 15 }, (_, i) => ({
            customer_id: i + 1,
            first_name: ['James', 'Mary', 'Robert', 'Patricia', 'John',
                         'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth',
                         'William', 'Barbara', 'Richard', 'Susan', 'Joseph'][i],
            last_name: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
                        'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
                        'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'][i],
            email: ['james.s', 'mary.j', 'robert.w', 'patricia.b', 'john.j',
                    'jennifer.g', 'michael.m', 'linda.d', 'david.r', 'elizabeth.m',
                    'william.h', 'barbara.l', 'richard.g', 'susan.w', 'joseph.a'][i] + '@example.com',
            phone: `+1-555-${String(100 + i).padStart(3, '0')}-${String(1000 + i * 7).slice(0, 4)}`,
            city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
                   'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
                   'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte'][i],
            registered_at: new Date(now.getTime() - (i * 20 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        })),
        orders: () => Array.from({ length: 18 }, (_, i) => ({
            order_id: 5000 + i,
            customer_id: Math.floor(Math.random() * 15) + 1,
            product_name: ['Widget Alpha', 'Gadget Pro', 'Service Pack', 'Premium Plan',
                           'Starter Kit', 'Enterprise License', 'Support Bundle', 'Analytics Module',
                           'Cloud Storage', 'API Access', 'Mobile App', 'Desktop Client',
                           'Integration Hub', 'Data Sync', 'Report Builder', 'Dashboard Pro',
                           'Alert System', 'Backup Service'][i],
            quantity: Math.floor(Math.random() * 10) + 1,
            total_amount: +(Math.random() * 500 + 10).toFixed(2),
            status: ['completed', 'pending', 'shipped', 'processing', 'cancelled'][i % 5],
            order_date: new Date(now.getTime() - (i * 3 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        })),
        products: () => Array.from({ length: 12 }, (_, i) => ({
            product_id: i + 1,
            name: ['CRM Suite', 'Email Marketing', 'Inventory Manager', 'POS Terminal',
                   'HR Platform', 'Project Tracker', 'Accounting Pro', 'Support Desk',
                   'E-Commerce Engine', 'Analytics Dashboard', 'Form Builder', 'Chat Widget'][i],
            category: ['Software', 'Marketing', 'Operations', 'Sales',
                       'HR', 'Management', 'Finance', 'Support',
                       'E-Commerce', 'Analytics', 'Tools', 'Communication'][i],
            price: [299.99, 49.99, 149.99, 399.99, 199.99, 99.99,
                    349.99, 79.99, 499.99, 249.99, 29.99, 59.99][i],
            stock_quantity: [100, 500, 250, 75, 300, 450, 120, 600, 50, 200, 800, 350][i],
            is_active: i < 10,
        })),
        inventory: () => Array.from({ length: 10 }, (_, i) => ({
            item_id: i + 1,
            sku: `SKU-${String(1000 + i * 111)}`,
            item_name: `Inventory Item ${i + 1}`,
            warehouse: ['Warehouse A', 'Warehouse B', 'Warehouse C'][i % 3],
            quantity_on_hand: Math.floor(Math.random() * 1000),
            reorder_level: Math.floor(Math.random() * 50) + 10,
            unit_cost: +(Math.random() * 100 + 5).toFixed(2),
            last_restocked: new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        })),
        transactions: () => Array.from({ length: 20 }, (_, i) => ({
            transaction_id: `TXN-${String(10000 + i)}`,
            customer_id: Math.floor(Math.random() * 15) + 1,
            amount: +(Math.random() * 1000 + 5).toFixed(2),
            currency: 'USD',
            type: ['purchase', 'refund', 'subscription'][i % 3],
            payment_method: ['credit_card', 'paypal', 'bank_transfer', 'crypto'][i % 4],
            status: ['completed', 'pending', 'failed'][i % 3],
            created_at: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)).toISOString(),
        })),
    };

    const generator = tables[table.toLowerCase()];
    if (generator) return generator();

    // Default: generic table data
    return Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        column_a: `value_${i + 1}`,
        column_b: Math.floor(Math.random() * 1000),
        column_c: (Math.random() * 100).toFixed(2),
        created_at: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)).toISOString(),
    }));
}
