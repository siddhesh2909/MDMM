import React from 'react';
import './DataTable.css';

export interface Column<T> {
    header: string;
    accessorKey?: keyof T | string;
    cell?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    className?: string;
    onRowClick?: (item: T) => void;
}

export function DataTable<T>({ data, columns, className = '', onRowClick }: DataTableProps<T>) {
    return (
        <div className={`data-table-container ${className}`}>
            <table className="data-table">
                <thead>
                    <tr>
                        {columns.map((col, i) => (
                            <th key={i}>{col.header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                No records found.
                            </td>
                        </tr>
                    ) : (
                        data.map((item, rowIndex) => (
                            <tr
                                key={rowIndex}
                                onClick={() => onRowClick && onRowClick(item)}
                                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                            >
                                {columns.map((col, colIndex) => {
                                    let content: React.ReactNode = '';
                                    if (col.cell) {
                                        content = col.cell(item);
                                    } else if (col.accessorKey) {
                                        content = String(item[col.accessorKey as keyof T] ?? '');
                                    }

                                    return <td key={colIndex}>{content}</td>;
                                })}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
