// pages/api/download.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
        return NextResponse.json(
            { error: 'No ID provided in the URL' },
            { status: 400 }
        );
    }

    try {
        // First API call to get file info
        // const infoUrl = `https://terabox.hnn.workers.dev/api/get-info?shorturl=${id}&pwd=`;
            const infoUrl = `https://terabox.hnn.workers.dev/api/get-info?shorturl=${id}&pwd=&_=${Date.now()}`;
        const infoResponse = await fetch(infoUrl);

        if (!infoResponse.ok) {
            throw new Error(`First API request failed with status: ${infoResponse.status}`);
        }

        const jsonResult = await infoResponse.json();

        // Prepare second request data
        const postData = {
            shareid: jsonResult.shareid,
            uk: jsonResult.uk,
            sign: jsonResult.sign,
            timestamp: jsonResult.timestamp,
            fs_id: jsonResult.list?.[0]?.fs_id,
        };

        // Second API call to get download link
        const downloadResponse = await fetch('https://terabox.hnn.workers.dev/api/get-downloadp', {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9,hi;q=0.8',
                'content-type': 'application/json',
                'origin': 'https://terabox.hnn.workers.dev',
                'priority': 'u=1, i',
                'referer': 'https://terabox.hnn.workers.dev/',
                'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            },
            body: JSON.stringify(postData),
        });

        if (!downloadResponse.ok) {
            throw new Error(`Second API request failed with status: ${downloadResponse.status}`);
        }

        const jsonResult2 = await downloadResponse.json();

        // Redirect if download link exists
        if (jsonResult2.downloadLink) {
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': jsonResult2.downloadLink
                }
            });
        }

        return NextResponse.json(jsonResult2);

    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}