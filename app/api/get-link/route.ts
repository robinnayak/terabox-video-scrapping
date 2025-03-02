import axios from 'axios';
import { NextResponse } from 'next/server';

interface TeraboxFile {
    fs_id: string;
    filename: string;
    size: number;
    md5: string;
    thumbs?: {
        url_3?: string;
    };
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

interface FileInfo {
    name: string;
    size: number;
    md5: string;
    thumbnail?: string;
}

interface ApiResponse {
    success: boolean;
    error?: string;
    downloadUrl?: string;
    fileInfo?: FileInfo;
}

interface DownloadHeaders {
    [key: string]: string;
    'Content-Type': string;
    'Content-Disposition': string;
    'Access-Control-Allow-Origin': string;
    'Cache-Control': string;
}

export async function GET(request: Request): Promise<Response> {
    try {
        // Parse URL parameters and validate ID
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
            console.debug('Invalid ID provided:', id);
            return NextResponse.json(
                { success: false, error: 'Invalid ID' },
                { status: 400 }
            );
        }

        console.debug(`Fetching metadata for ID: ${id}`);

        // Add a short delay to help avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Construct the metadata URL
        const metaUrl = `https://terabox.hnn.workers.dev/api/get-info?shorturl=${id}&pwd=`;
        console.debug('Metadata URL:', metaUrl);

        // Get file metadata from the external service
        const metaResponse = await axios.get<TeraboxMetadata>(metaUrl, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                Referer: 'https://terabox.hnn.workers.dev/',
            }
        });

        console.debug('Metadata response:', metaResponse.data);
        const metadata = metaResponse.data;

        if (!metadata?.list || metadata.list.length === 0 || !metadata.list[0].fs_id) {
            throw new Error('No files found in metadata');
        }

        // Select the first file for processing
        const fileData = metadata.list[0];
        console.debug('Selected file data:', fileData);

        const postData = {
            fs_id: fileData.fs_id,
            shareid: metadata.shareid,
            sign: metadata.sign,
            timestamp: metadata.timestamp,
            uk: metadata.uk
        };
        console.debug('Post data:', postData);
        // Fetch the direct download link
        console.debug('Requesting download link...');
        const dlResponse = await axios.post<TeraboxDownloadData>(
            'https://terabox.hnn.workers.dev/api/get-downloadp',
            postData,
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    Referer: 'https://terabox.hnn.workers.dev/',
                }
            }
        );

        console.debug('Download link response:', dlResponse.data);
        const downloadUrl = dlResponse.data?.downloadLink;
        if (!downloadUrl) {
            throw new Error('No download link returned');
        }

        // Proxy the download through your server
        console.debug('Downloading file from URL:', downloadUrl);
        console.debug('Initiating secure download proxy');
        const fileResponse = await axios.get(downloadUrl, {
            responseType: 'stream',
            headers: {
                Referer: 'https://terabox.hnn.workers.dev/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                Range: 'bytes=0-' // Ensures partial content support
            }
        });

        console.debug('File downloaded successfully. Sending response...');
        // console.debug('File :', fileResponse.data);
        // Create headers object
        const headers: DownloadHeaders = {
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileData.filename)}"`,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'private, max-age=3600',
            'X-File-Name': fileData.filename,
            'X-File-Size': fileData.size.toString(),
            'X-File-Md5': fileData.md5,
        };
        // Create readable stream
        const readableStream = new ReadableStream({
            start(controller) {
                fileResponse.data.on('data', (chunk: Buffer) => {
                    controller.enqueue(new Uint8Array(chunk));
                });
                fileResponse.data.on('end', () => controller.close());
                fileResponse.data.on('error', (err: Error) => controller.error(err));
            }
        });

        console.debug('Stream created successfully. Sending response...');
        console.log('Headers:', headers);
        // console.log('Stream:', readableStream);

        return new Response(readableStream, { headers });
    } catch (error: any) {
        console.error('Error in GET route:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'An error occurred' },
            { status: 500 }
        );
    }
}
