const axios = require('axios');
const mongoPool = require('../services/mongoConnectionPool');
const env = require('../config/env');
const fs = require('fs');
const path = require('path');

/** 
 * CONFIGURATION
 * To use automated CAPTCHA solving, set your 2Captcha API Key in the .env file or as an environment variable.
 */
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY || ''; // Set in your environment
const SITE_KEY = '883479e0-e276-482c-915f-00b65eaa4356';
const PAGE_URL = 'https://www.doenets.lk/';
const DELAY_MS = 2000; // 2 seconds between requests
const OUTPUT_FILE = path.join(__dirname, '../output/doenets_results.json');

let currentToken = process.argv[2] || ''; // Initial token from CLI

if (!fs.existsSync(path.join(__dirname, '../output'))) {
    fs.mkdirSync(path.join(__dirname, '../output'));
}

/**
 * Solves hCaptcha using 2Captcha API.
 */
async function solveHCaptcha() {
    if (!CAPTCHA_API_KEY) {
        throw new Error('CAPTCHA_API_KEY is not set. Cannot solve CAPTCHA automatically.');
    }

    console.log('⏳ Sending CAPTCHA solving request to 2Captcha...');

    try {
        // Step 1: Submit CAPTCHA
        const submitRes = await axios.get(`http://2captcha.com/in.php?key=${CAPTCHA_API_KEY}&method=hcaptcha&sitekey=${SITE_KEY}&pageurl=${PAGE_URL}&json=1`);
        
        if (submitRes.data.status !== 1) {
            throw new Error(`2Captcha Submit Error: ${submitRes.data.request}`);
        }

        const requestId = submitRes.data.request;
        console.log(`✅ CAPTCHA submitted (ID: ${requestId}). Waiting for solver...`);

        // Step 2: Poll for result
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before polling

            const res = await axios.get(`http://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${requestId}&json=1`);
            
            if (res.data.status === 1) {
                console.log('🎉 CAPTCHA solved successfully!');
                return res.data.request;
            }

            if (res.data.request !== 'CAPCHA_NOT_READY') {
                throw new Error(`2Captcha Result Error: ${res.data.request}`);
            }

            console.log(`   [Attempt ${attempts}] Still waiting...`);
        }

        throw new Error('2Captcha Timed Out.');
    } catch (err) {
        console.error('❌ Error solving CAPTCHA:', err.message);
        return null;
    }
}

async function fetchResult(nic) {
    if (!currentToken) {
        console.log(`⚠️ No token available. Attempting to solve CAPTCHA...`);
        currentToken = await solveHCaptcha();
        if (!currentToken) return { error: 'NO_TOKEN' };
    }

    const url = `https://result.doenets.lk/result/service/AlResult?index=&nic=${nic}&h-captcha-response=${currentToken}`;
    
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'dnt': '1',
        'origin': 'https://www.doenets.lk',
        'priority': 'u=1, i',
        'referer': 'https://www.doenets.lk/',
        'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
    };

    try {
        const response = await axios.get(url, { headers });
        
        // If results return with "Captcha Not Solved", we need a refresh
        if (response.data && response.data.errMsge === 'Captcha Not Solved.') {
            return { error: 'CAPTCHA_EXPIRED' };
        }
        
        return { data: response.data };
    } catch (error) {
        if (error.response && error.response.status === 403) {
            return { error: 'IP_BLOCKED' };
        }
        if (error.response && error.response.status === 400) {
            // Check for captcha error in the response data
            if (error.response.data && error.response.data.errMsge === 'Captcha Not Solved.') {
                return { error: 'CAPTCHA_EXPIRED' };
            }
        }
        console.error(`[NIC: ${nic}] ❌ Error: ${error.message}`);
        return { error: error.message };
    }
}

function extractResults(data) {
    if (!data) return null;

    const districtRank = data.districtRank || getFromStudentInfo(data, 'District Rank');
    const islandRank = data.islandRank || getFromStudentInfo(data, 'Island Rank');
    const zScore = data.zScore || getFromStudentInfo(data, 'Z-Score');

    return {
        nic: data.nic || getFromStudentInfo(data, 'NIC Number'),
        name: data.name || getFromStudentInfo(data, 'Name'),
        districtRank,
        islandRank,
        zScore,
        stream: data.stream || getFromStudentInfo(data, 'Subject Stream')
    };
}

function getFromStudentInfo(data, paramName) {
    if (!data.studentInfo || !Array.isArray(data.studentInfo)) return '-';
    const info = data.studentInfo.find(info => info.param === paramName);
    return info ? info.value : '-';
}

async function startBatchFetch() {
    console.log('🚀 Starting batch fetch for NICs with Automated CAPTCHA solving...');
    if (!CAPTCHA_API_KEY) {
        console.log('⚠️ Warning: CAPTCHA_API_KEY not found in environment.');
        console.log('   Script will only work if you provide an initial token via CLI.');
    }
    
    try {
        const collection = await mongoPool.getCollection(env.MONGODB_COLLECTION);
        const docs = await collection.find({}, { projection: { NIC: 1, _id: 0 } }).toArray();
        const nics = [...new Set(docs.map(doc => doc.NIC).filter(nic => !!nic))];

        console.log(`📊 Found ${nics.length} unique NICs to process.`);

        const results = [];
        
        for (let i = 0; i < nics.length; i++) {
            const nic = nics[i];
            console.log(`[${i + 1}/${nics.length}] Processing NIC: ${nic}...`);
            
            let response = await fetchResult(nic);
            
            // Handle CAPTCHA expiration or missing token
            if (response.error === 'CAPTCHA_EXPIRED' || response.error === 'NO_TOKEN') {
                console.log(`⚠️ Token expired or missing. Solving new CAPTCHA...`);
                currentToken = await solveHCaptcha();
                
                if (currentToken) {
                    console.log(`🔄 Retrying NIC: ${nic} with new token...`);
                    response = await fetchResult(nic);
                } else {
                    console.error(`❌ Failed to solve CAPTCHA. Skipping NIC: ${nic}`);
                    results.push({ nic, status: 'failed', reason: 'CAPTCHA_SOLVE_FAILED' });
                    continue;
                }
            }

            if (response.data) {
                const extracted = extractResults(response.data);
                console.log(` ✅ Found: DRank: ${extracted.districtRank}, IRank: ${extracted.islandRank}, ZScore: ${extracted.zScore}`);
                results.push({
                    nic,
                    data: extracted,
                    status: 'success'
                });
            } else if (response.error === 'IP_BLOCKED') {
                console.error(`🛑 IP BLOCKED. Stopping process.`);
                break;
            } else {
                results.push({
                    nic,
                    status: 'failed',
                    reason: response.error
                });
            }

            // Progress Save and Rate limit
            if (i % 5 === 0 || i === nics.length - 1) {
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
            }

            if (i < nics.length - 1) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        console.log(`\n🏁 Batch fetch completed!`);
        console.log(`📊 Total Success: ${results.filter(r => r.status === 'success').length}`);
        console.log(`📊 Total Failed: ${results.filter(r => r.status === 'failed').length}`);
        console.log(`📁 Results saved to: ${OUTPUT_FILE}`);

    } catch (err) {
        console.error('❌ Critical Error during batch process:', err.message);
    } finally {
        await mongoPool.close();
    }
}

startBatchFetch();
