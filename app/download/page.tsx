"use client";
import React, { useState } from "react";

const DownloadPage = () => {
    const [inputUrl, setInputUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const extractSurlId = (url: string) => {
        try {
            const parsedUrl = new URL(url);
            const surl = parsedUrl.searchParams.get("surl");
            if (!surl) throw new Error("Invalid Terabox URL format");
            return surl;
        } catch (err) {
            console.error("Invalid Terabox URL:", err);
            setError("Please enter a valid Terabox sharing URL");
            return null;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const surlId = extractSurlId(inputUrl);
            if (!surlId) return;

            // Create hidden anchor for download
            const downloadLink = document.createElement("a");
            downloadLink.href = `/api/stream-link?id=${encodeURIComponent(surlId)}`;
            downloadLink.setAttribute("rel", "noopener noreferrer");
            downloadLink.setAttribute("target", "_blank");
            
            // Important security attributes
            downloadLink.setAttribute("referrerpolicy", "no-referrer");
            downloadLink.setAttribute("crossorigin", "anonymous");
            
            // For better accessibility
            downloadLink.setAttribute("aria-label", "Terabox video download");
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

        } catch (err) {
            console.error("Download failed:", err);
            setError(err instanceof Error ? err.message : "Failed to start download");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex gap-4">
                    <input
                        type="url"
                        value={inputUrl}
                        onChange={(e) => {
                            setInputUrl(e.target.value);
                            setError("");
                        }}
                        placeholder="Paste Terabox sharing link"
                        className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        required
                        pattern="https?://.*terabox\.(app|com)/sharing/link\?surl=.*"
                        title="Example: https://www.terabox.app/sharing/link?surl=XXXXXX"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                    >
                        {loading ? (
                            <span className="flex items-center">
                                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                                    {/* ... spinner SVG ... */}
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            "Download Now"
                        )}
                    </button>
                </div>
                {error && (
                    <div className="text-red-500 text-sm mt-2 p-3 bg-red-50 rounded-lg">
                        ⚠️ {error}
                    </div>
                )}
                <p className="text-gray-500 text-sm mt-4">
                    Note: The download will open in a new tab. Please disable popup blockers for this site.
                </p>
            </form>
        </div>
    );
};

export default DownloadPage;