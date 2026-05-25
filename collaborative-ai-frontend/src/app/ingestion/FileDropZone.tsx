'use client';

import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';

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
            className={`file-drop-zone ${isDragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
        >
            <input
                id="file-upload"
                type="file"
                className="hidden"
                style={{ display: 'none' }}
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileInput}
            />

            <div className="file-icon">
                <UploadCloud size={32} />
            </div>
            <div className="file-title">
                Drag & Drop your file here
            </div>
            <div className="file-subtitle">
                Supports CSV, JSON, and Excel documents. Or click to browse.
            </div>
        </div>
    );
}
