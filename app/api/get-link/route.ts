import { NextResponse } from 'next/server';

interface TeraboxFile {
    fs_id: string;
    filename: string;
    size: number;
    md5: string;
    thumbs?: { url_3?: string };
}

interface TeraboxMetadata {
    shareid: string;
    uk: string;
    sign: string;
    timestamp: string;
    list: TeraboxFile[];
}
interface TeraboxDownloadData {
    downloadLink?: string;
    error?: string;
}

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Referer: 'https://terabox.hnn.workers.dev/',
};

const VALID_ID_REGEX = /^[A-Za-z0-9_-]{6,}$/;
const API_TIMEOUT = 10000; // 10 seconds

export async function GET(request: Request): Promise<Response> {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        // Validate ID parameter
        if (!id || !VALID_ID_REGEX.test(id)) {
            return NextResponse.json(
                { success: false, error: 'Invalid or missing ID parameter' },
                { status: 400 }
            );
        }

        // Fetch metadata with timeout
        const metadata = await fetchWithTimeout<TeraboxMetadata>(
            `https://terabox.hnn.workers.dev/api/get-info?shorturl=${id}&pwd=`,
            { headers: DEFAULT_HEADERS }
        );

        console.log("getinfo data", metadata);


        // Validate metadata structure
        if (!metadata?.list?.[0]?.fs_id) {
            throw new Error('Invalid metadata structure or empty file list');
        }

        const fileData = metadata.list[0];
        const downloadLink = await getDownloadLink(metadata, fileData);

        console.log("downloadLink", downloadLink);
        // Proxy the file stream
        const fileResponse = await fetch(downloadLink, {
            headers: DEFAULT_HEADERS,
            //   signal: AbortSignal.timeout(API_TIMEOUT),
        });

        if (!fileResponse.ok || !fileResponse.body) {
            throw new Error('Failed to fetch file stream');
        }

        // Prepare response headers
        // const headers = new Headers({
        //     'Content-Type': fileResponse.headers.get('Content-Type') || 'application/octet-stream',
        //     'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileData.filename)}`,
        //     'Accept-Ranges': 'bytes',
        //     'Content-Length': fileData.size.toString(),
        //     'Cache-Control': 'public, max-age=3600',
        //     'ETag': `"${fileData.md5}"`,
        //   });


        const headers = new Headers({
            'Content-Type': fileResponse.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileData.filename)}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': fileData.size.toString(),
            'Cache-Control': 'public, max-age=3600',
            //   'ETag': `"${fileData.md5}"`,
            'X-File-Name': encodeURIComponent(fileData.filename),
            'X-File-Size': fileData.size.toString(),
            'X-File-Md5': fileData.md5,
        });

        // Add CORS headers if needed
        if (process.env.NODE_ENV === 'development') {
            headers.set('Access-Control-Allow-Origin', '*');
        }

        return new Response(fileResponse.body, {
            headers,
            status: 200,
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Internal server error',
                code: error.code || 'SERVER_ERROR'
            },
            { status: 500 }
        );
    }
}

async function getDownloadLink(metadata: TeraboxMetadata, fileData: TeraboxFile): Promise<string> {
    const postData = {
        fs_id: fileData.fs_id,
        shareid: metadata.shareid,
        sign: metadata.sign,
        timestamp: metadata.timestamp,
        uk: metadata.uk
    };

    const response = await fetchWithTimeout<TeraboxDownloadData>(
        'https://terabox.hnn.workers.dev/api/get-downloadp',
        {
            method: 'POST',
            headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify(postData),
        }
    );

    if (!response.downloadLink) {
        throw new Error('No download link received from upstream');
    }
    console.log("downloadLink", response.downloadLink);

    return response.downloadLink;
}

async function fetchWithTimeout<T>(url: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });

        if (!response.ok) {
            // Optionally, you can try to extract error details from the response
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

