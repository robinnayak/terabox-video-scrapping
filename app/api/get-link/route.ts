import { NextResponse } from 'next/server';
// export const runtime = 'edge';

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
  'Referer': 'https://www.terabox.com/',
  'Origin': 'https://www.terabox.com',
  'Cookie': `ndut_fm=${Date.now()}`,
};

const VALID_ID_REGEX = /^[A-Za-z0-9_-]{6,}$/;
const API_TIMEOUT = 10000;
const CACHE_TTL = 300000; // 5 minutes
const cache = new Map<string, { expiry: number; link: string; metadata?: TeraboxFile }>();

// List of client headers to forward
const CLIENT_HEADERS_TO_FORWARD = [
  'cookie',
  'range',
  'if-range',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'x-requested-with',
  'accept-encoding',
  'sec-ch-ua-platform'
];

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const format = searchParams.get('format');

    if (!id || !VALID_ID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Check cache first
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

    console.log("metadata", metadata);
    if (!metadata?.list?.[0]?.fs_id) {
      throw new Error('Invalid file metadata');
    }

    const fileData = metadata.list[0];
    const downloadLink = await getDownloadLink(metadata, fileData);
    console.log("downloadLink", downloadLink);
    // Update cache
    cache.set(id, {
      expiry: Date.now() + CACHE_TTL,
      link: downloadLink,
      metadata: fileData
    });

    // Return JSON response if requested
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

    // Get client-supplied range (if any)
    const rangeHeader = request.headers.get('range');
    console.log("rangeHeader", rangeHeader);

    // Forward only the required headers from the client
    const forwardHeaders: Record<string, string> = {};
    for (const header of CLIENT_HEADERS_TO_FORWARD) {
      const value = request.headers.get(header);
      if (value) {
        // Normalize header names as needed
        if (header.toLowerCase() === 'if-range') {
          forwardHeaders['If-Range'] = value;
        } else if (header.toLowerCase() === 'cookie') {
          forwardHeaders['Cookie'] = value;
        } else if (header.toLowerCase() === 'range') {
          forwardHeaders['Range'] = value;
        } else if (header.toLowerCase() === 'sec-fetch-dest') {
          forwardHeaders['Sec-Fetch-Dest'] = value;
        } else if (header.toLowerCase() === 'sec-fetch-mode') {
          forwardHeaders['Sec-Fetch-Mode'] = value;
        } else if (header.toLowerCase() === 'sec-fetch-site') {
          forwardHeaders['Sec-Fetch-Site'] = value;
        } else if (header.toLowerCase() === 'sec-ch-ua') {
          forwardHeaders['Sec-CH-UA'] = value;
        } else if (header.toLowerCase() === 'sec-ch-ua-mobile') {
          forwardHeaders['Sec-CH-UA-Mobile'] = value;
        } else if (header.toLowerCase() === 'sec-ch-ua-platform') {
          forwardHeaders['Sec-CH-UA-Platform'] = value;
        } else {
          forwardHeaders[header] = value;
        }
      }
    }

    // If no range provided, do not include the Range header
    if (!rangeHeader) {
      console.log("No range header provided. Fetching full file.");
      delete forwardHeaders['Range'];
    }

    // Merge the default headers and forwarded client headers
    const fetchHeaders = {
      ...DEFAULT_HEADERS,
      ...forwardHeaders,
      'X-Requested-With': 'XMLHttpRequest', // Required for some CDNs
    };

    const fetchOptions: RequestInit = {
      headers: fetchHeaders,
      redirect: 'follow',
    };

    console.log("fetchOptions", fetchOptions);

    // Fetch (stream) the file from the download link
    const fileResponse = await fetch(downloadLink, fetchOptions);
    console.log("====================================");
    console.log("fileResponse", fileResponse.body);
    console.log("====================================");

    if (!fileResponse.ok && fileResponse.status !== 206) {
      throw new Error(`Failed to retrieve file: ${fileResponse.status} ${fileResponse.statusText}`);
    }

    // Prepare response headers for the client
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

    // Forward content-specific headers from the upstream response
    fileResponse.headers.forEach((value, key) => {
      if (['content-length', 'content-range'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    console.log("responseHeaders", responseHeaders);

    // Return the streamed file response to the client
    return new Response(fileResponse.body, {
      status: fileResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.log("error", error);
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

// Helper function to get the download link
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

// Helper function to fetch with timeout
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
