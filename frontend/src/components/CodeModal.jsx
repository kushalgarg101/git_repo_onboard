import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { X, FileCode, Clock, Users, ArrowRight, Code2 } from "lucide-react";
import Editor from "@monaco-editor/react";

export default function CodeModal({ node, onClose }) {
    if (!node) return null;

    // Determine Monaco language based on node language or extension
    const getLanguage = () => {
        if (node.language) {
            const lang = node.language.toLowerCase();
            if (lang === "py") return "python";
            if (lang === "js") return "javascript";
            if (lang === "ts") return "typescript";
            return lang;
        }
        const parts = String(node.id).split(".");
        const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
        if (ext === "py") return "python";
        if (ext === "js" || ext === "jsx") return "javascript";
        if (ext === "ts" || ext === "tsx") return "typescript";
        if (ext === "json") return "json";
        if (ext === "html") return "html";
        if (ext === "css") return "css";
        return "javascript";
    };

    const hasCode = !!node.content;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-12">
            {/* Dimmed backdrop */}
            <div
                className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <Card className="relative w-full max-w-5xl h-[85vh] flex flex-col bg-zinc-950/90 border border-white/10 shadow-2xl rounded-2xl overflow-hidden shadow-black/50">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/10 shrink-0 bg-black/40">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 capitalize shrink-0">
                            {node.type || "unknown"}
                        </Badge>
                        <div>
                            <h3 className="text-lg font-semibold text-zinc-100 leading-tight">
                                {node.label || node.id}
                            </h3>
                            <p className="text-xs font-mono text-zinc-500">{node.id}</p>
                        </div>
                    </div>
                    <button
                        className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats Bar */}
                <div className="flex items-center gap-6 px-4 py-2 bg-zinc-900/50 border-b border-white/5 text-xs text-zinc-400 shrink-0">
                    <span className="flex items-center gap-1.5"><FileCode className="w-3.5 h-3.5" /> {node.language || "Unknown"}</span>
                    <span className="flex items-center gap-1.5"><ArrowRight className="w-3.5 h-3.5" /> {node.line_count || 0} lines</span>
                    {node.complexity && <span className="flex items-center gap-1.5 text-amber-500/80"><ArrowRight className="w-3.5 h-3.5" /> Complexity: {node.complexity}</span>}
                </div>

                {/* Editor Area */}
                <div className="flex-1 min-h-0 bg-[#0d0d0d]">
                    {hasCode ? (
                        <Editor
                            height="100%"
                            language={getLanguage()}
                            theme="vs-dark"
                            value={node.content}
                            options={{
                                readOnly: true,
                                minimap: { enabled: true, renderCharacters: false },
                                scrollBeyondLastLine: false,
                                fontSize: 13,
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                padding: { top: 24, bottom: 24 },
                                renderLineHighlight: "all",
                                cursorBlinking: "smooth",
                                smoothScrolling: true,
                                cursorWidth: 2,
                            }}
                        />
                    ) : (
                        <div className="flex flex-col h-full items-center justify-center p-6 text-center text-zinc-500">
                            <Code2 className="w-12 h-12 mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-zinc-300 mb-1">Source Code Unavailable</h3>
                            <p className="text-sm">The content payload for this specific node was not captured by the parser.</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
