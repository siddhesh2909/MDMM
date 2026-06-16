'use client';

import React, { useState } from 'react';
import { CloudUpload } from 'lucide-react';

interface FileDropZoneProps {
    onFileSelect: (file: File) => void;
}

export function FileDropZone({ onFileSelect }: FileDropZoneProps) {
    const [isDragActive, setIsDragActive] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragActive(true);
        } else if (e.type === 'dragleave') {
            setIsDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    return (
        <div
            className={`dz-root${isDragActive ? ' dz-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload-input')?.click()}
        >
            <input
                id="file-upload-input"
                type="file"
                style={{ display: 'none' }}
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileInput}
            />
            <div className="dz-icon-wrap">
                <CloudUpload size={26} />
            </div>
            <p className="dz-title">Drag &amp; drop files here or click to browse</p>
            <p className="dz-subtitle">Supports CSV, Excel, JSON and more</p>
            <div className="dz-badges" onClick={(e) => e.stopPropagation()}>
                <span className="dz-badge dz-badge--csv">● CSV</span>
                <span className="dz-badge dz-badge--excel">● Excel</span>
                <span className="dz-badge dz-badge--json">● JSON</span>
                <span className="dz-badge dz-badge--more">+ More</span>
            </div>
        </div>
    );
}