import { NextResponse } from 'next/server';
export const runtime = 'edge';

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
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Referer: 'https://terabox.hnn.workers.dev/',
};

const VALID_ID_REGEX = /^[A-Za-z0-9_-]{6,}$/;
const API_TIMEOUT = 10000;
const CACHE_TTL = 300000; // 5 minutes
const cache = new Map<string, { expiry: number; link: string; metadata?: TeraboxFile }>();

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const format = searchParams.get('format');

    if (!id || !VALID_ID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Cache check and response (unchanged)
    const cached = cache.get(id);
    if (cached && cached.expiry > Date.now()) {
      if (format === 'json') {
        return NextResponse.json({
          downloadUrl: cached.link,
          fileName: cached.metadata?.filename,
          fileSize: cached.metadata?.size,
        }, { 
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range',
          }
        });
      }
      return NextResponse.redirect(cached.link, {
        status: 307,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
        },
      });
    }

    // Fetch metadata
    const metadata = await fetchWithTimeout<TeraboxMetadata>(
      `https://terabox.hnn.workers.dev/api/get-info?shorturl=${id}&pwd=`,
      { headers: DEFAULT_HEADERS }
    );

    if (!metadata?.list?.[0]?.fs_id) {
      throw new Error('Invalid file metadata');
    }

    const fileData = metadata.list[0];
    const downloadLink = await getDownloadLink(metadata, fileData);

    // Update cache
    cache.set(id, { 
      expiry: Date.now() + CACHE_TTL, 
      link: downloadLink,
      metadata: fileData
    });

    // Handle JSON response
    if (format === 'json') {
      return NextResponse.json({
        downloadUrl: downloadLink,
        fileName: fileData.filename,
        fileSize: fileData.size,
      }, { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
        }
      });
    }

    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Main fix: Removed redirect logic for large files
    const rangeHeader = request.headers.get('range');
    
    // Configure fetch with proper headers
    const fetchOptions: RequestInit = {
      headers: {
        ...DEFAULT_HEADERS,
        Cookie: request.headers.get('Cookie') || '',
        Range: rangeHeader || '',
      },
      redirect: 'follow',
    };

    // Stream the file directly
    const fileResponse = await fetch(downloadLink, fetchOptions);
    
    if (!fileResponse.ok && fileResponse.status !== 206) {
      throw new Error(`Failed to retrieve file: ${fileResponse.status} ${fileResponse.statusText}`);
    }

    // Prepare response headers
    const responseHeaders = new Headers({
      'Content-Type': fileResponse.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileData.filename)}`,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Cache-Control': 'public, max-age=3600',
      'X-File-Name': encodeURIComponent(fileData.filename),
      'X-File-Size': fileData.size.toString(),
      'X-File-Md5': fileData.md5,
    });

    // Add content headers
    fileResponse.headers.forEach((value, key) => {
      if (['content-length', 'content-range'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(fileResponse.body, {
      status: fileResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error processing request: ${error.message}`);
    } else {
      console.error('Error processing request:', error);
    }
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : 'Server error') },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// Remaining helper functions unchanged
async function getDownloadLink(
  metadata: TeraboxMetadata,
  fileData: TeraboxFile
): Promise<string> {
  const postData = {
    fs_id: fileData.fs_id,
    shareid: metadata.shareid,
    sign: metadata.sign,
    timestamp: metadata.timestamp,
    uk: metadata.uk,
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
  return response.downloadLink;
}

async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
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