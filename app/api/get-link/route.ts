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
const cache = new Map<string, { expiry: number; link: string }>();

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const format = searchParams.get('format'); // if "json", return JSON response

    if (!id || !VALID_ID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Check cache and ensure it hasn't expired
    const cached = cache.get(id);
    if (cached && cached.expiry > Date.now()) {
      if (format === 'json') {
        return NextResponse.json({ downloadUrl: cached.link }, { status: 200 });
      }
      return NextResponse.redirect(cached.link, {
        status: 307,
        headers: {
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    }

    // Fetch metadata from upstream
    const metadata = await fetchWithTimeout<TeraboxMetadata>(
      `https://terabox.hnn.workers.dev/api/get-info?shorturl=${id}&pwd=`,
      { headers: DEFAULT_HEADERS }
    );

    if (!metadata?.list?.[0]?.fs_id) {
      throw new Error('Invalid file metadata');
    }

    const fileData = metadata.list[0];
    const downloadLink = await getDownloadLink(metadata, fileData);

    console.log('get download - downloadLink', downloadLink);

    // Update cache
    cache.set(id, { expiry: Date.now() + CACHE_TTL, link: downloadLink });

    // If JSON format requested, return a JSON response
    if (format === 'json') {
      const jsonResponse = {
        downloadUrl: downloadLink,
        fileName: fileData.filename,
        fileSize: fileData.size,
      };
      return NextResponse.json(jsonResponse, { status: 200 });
    }

    // Otherwise, fetch the file binary and return a download response
    const fileResponse = await fetch(downloadLink, {
      headers: DEFAULT_HEADERS,
      redirect: 'manual',
    });
    if (!fileResponse.ok || !fileResponse.body) {
      throw new Error('Failed to retrieve download link');
    }

    const headers = new Headers({
      'Content-Type':
        fileResponse.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        fileData.filename
      )}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': fileData.size.toString(),
      'Cache-Control': 'public, max-age=3600',
      'X-File-Name': encodeURIComponent(fileData.filename),
      'X-File-Size': fileData.size.toString(),
      'X-File-Md5': fileData.md5,
    });

    return new Response(fileResponse.body, {
      headers,
      status: 200,
    });
  } catch (error: any) {
    console.error(`Error processing request: ${error.message}`);
    return NextResponse.json(
      { error: error.message || 'Server error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

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
  console.log('response - downloadLink', response.downloadLink);
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
