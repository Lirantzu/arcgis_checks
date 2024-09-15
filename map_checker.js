// Map names and IDs
const mapNames = {
    "3a64f1a338b64c1da39556f363321000": "אפליקציה חיצונית",
    "0e3643433dfd4039b1bd83488c4618dc": "הפקעות מטרו",
    "0171927ba282497aad1579c62b8c95b1": "גבולות עבודה נתע",
    "b5b46be4b36a412f85e712c6a716684e": "מתען 2050",
    "b9926cc754f645a9bb72bdea824f5be9": "אפליקציית סקרי עצים",
    "f3286b9e33a14add8f7c7296fa670caf": "מרחקי השפעה - תמא 70",
    "7e445c19c3964444ad3086ca350359e2": "מגרשים חופפים למסילות צד",
    "9ad9f3c465964920a65b57f000c647f4": {
        name: "תתל 133 - מסילות 5 ו-6",
        url: "https://gisportal02.tlv.gov.il/portal/sharing/rest/content/items/9ad9f3c465964920a65b57f000c647f4/data?f=json"
    },
};

const mapIds = Object.keys(mapNames);
const baseUrl = "https://ta-muni.maps.arcgis.com/sharing/rest/content/items/{mapId}/data?f=json";

const USERNAME = 'x3967755';
const PASSWORD = 'Lir728t!';
const PORTAL_URL = 'https://gisportal02.tlv.gov.il/portal';

let portalToken = '';

function getMapUrl(mapId) {
    if (mapNames[mapId] && typeof mapNames[mapId] === 'object' && mapNames[mapId].url) {
        return mapNames[mapId].url;
    }
    return `https://ta-muni.maps.arcgis.com/sharing/rest/content/items/${mapId}/data?f=json`;
}

async function getPortalToken(username, password) {
    const tokenUrl = `${PORTAL_URL}/sharing/rest/generateToken`;
    const params = new URLSearchParams({
        username: username,
        password: password,
        referer: window.location.origin,
        f: 'json',
        expiration: 60 // Token expiration in minutes
    });

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            body: params
        });
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }
        return data.token;
    } catch (error) {
        console.error('Error getting portal token:', error);
        throw error;
    }
}

async function testService(url) {
    try {
        let finalUrl = url;
        if (url.includes(PORTAL_URL)) {
            if (!portalToken) {
                portalToken = await getPortalToken(USERNAME, PASSWORD);
            }
            finalUrl = `${url}${url.includes('?') ? '&' : '?'}token=${portalToken}`;
        }
        
        // Append query parameters for JSON response if not already present
        if (!finalUrl.includes('f=json')) {
            finalUrl += `${finalUrl.includes('?') ? '&' : '?'}f=json`;
        }
        
        console.log(`Attempting to fetch: ${finalUrl}`);
        
        const response = await fetch(finalUrl, { 
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            },
            timeout: 15000 
        });
        
        console.log(`Response status: ${response.status}`);
        console.log(`Response type: ${response.type}`);
        console.log('Response headers:', Object.fromEntries(response.headers));
        
        const text = await response.text();
        console.log(`Response text (first 500 characters): ${text.substring(0, 500)}`);
        
        if (text.trim().startsWith('<')) {
            console.error('Received HTML instead of JSON');
            return { isAccessible: false, result: 'Received HTML instead of JSON', htmlContent: text };
        }
        
        const data = JSON.parse(text);
        if (data.error) {
            return { isAccessible: false, result: data.error.message };
        }
        return { isAccessible: true, result: data };
    } catch (error) {
        console.error(`Error in testService: ${error}`);
        return { isAccessible: false, result: error.toString() };
    }
}

async function checkVectorTileLayer(layer, indent = "") {
    const layerTitle = layer.title || 'Unnamed VectorTileLayer';
    appendToResults(`${indent}Checking VectorTileLayer: `, 'vector-tile-layer');
    appendToResults(`'${layerTitle}'`, 'important');

    const { isAccessible, result } = await testService(layer.styleUrl || `https://tiles.arcgis.com/tiles/PcGFyTym9yKZBRgz/arcgis/rest/services/${layerTitle}/VectorTileServer`);
    if (isAccessible) {
        appendToResults(` - Status: Accessible`, 'success');
    } else {
        appendToResults(` - Status: Not accessible`, 'error');
        appendToResults(` - Error: ${result}`, 'error');
    }
    appendToResults('\n'); // Add a line break after each layer check
    return isAccessible;
}

async function checkLayer(layer, indent = "") {
    const layerTitle = layer.title || 'Unnamed Layer';
    appendToResults(`${indent}Checking Layer: `, 'layer');
    appendToResults(`'${layerTitle}'`, 'important');

    if (layer.type === 'Group Layer' || layer.layerType === 'GroupLayer') {
        appendToResults(` - Group Layer`, 'info');
        appendToResults('\n'); // Add a line break after the group layer title
        let allChildrenAccessible = true;
        for (const childLayer of layer.layers || []) {
            const childAccessible = await checkLayer(childLayer, indent + "  ");
            allChildrenAccessible = allChildrenAccessible && childAccessible;
        }
        return allChildrenAccessible;
    }

    if (layer.layerType === 'VectorTileLayer') {
        return await checkVectorTileLayer(layer, indent);
    }

    let url = layer.url || layer.styleUrl;
    if (!url) {
        console.log(`Layer without URL:`, layer);
        appendToResults(` - Status: Not checkable (no URL)`, 'warning');
        appendToResults('\n'); // Add a line break after each layer check
        return false;
    }

    const { isAccessible, result } = await testService(url);
    if (isAccessible) {
        appendToResults(` - Status: Accessible`, 'success');
    } else {
        appendToResults(` - Status: Not accessible`, 'error');
        appendToResults(` - Error: ${result}`, 'error');
    }
    appendToResults('\n'); // Add a line break after each layer check
    return isAccessible;
}

async function checkSpecificMap(mapId) {
    const mapUrl = getMapUrl(mapId);
    console.log(`Fetching JSON data from URL: ${mapUrl}`);
    try {
        const response = await fetch(mapUrl);
        const mapData = await response.json();
        
        appendToResults(`Map Title: ${mapData.title}\n\n`, 'title');

        let allLayersOk = true;
        const problematicLayers = [];

        appendToResults("Checking Basemaps:\n", 'section');
        for (const baseMap of mapData.baseMap.baseMapLayers) {
            const layerOk = await checkLayer(baseMap);
            if (!layerOk) {
                allLayersOk = false;
                problematicLayers.push(baseMap.title || 'Unnamed Basemap Layer');
            }
        }

        appendToResults("\nChecking Operational Layers:\n", 'section');
        for (const layer of mapData.operationalLayers) {
            const layerOk = await checkLayer(layer);
            if (!layerOk) {
                allLayersOk = false;
                problematicLayers.push(layer.title || 'Unnamed Operational Layer');
            }
        }

        appendToResults("==================================================\n", 'separator');
        return { allLayersOk, mapTitle: mapData.title, problematicLayers };
    } catch (error) {
        console.error(`Failed to fetch web map data for map ID ${mapId}. Error: ${error}`);
        appendToResults(`Failed to fetch web map data for map ID ${mapId}. Error: ${error}\n`, 'error');
        return { allLayersOk: false, mapTitle: mapNames[mapId], problematicLayers: ['Unable to fetch map data'] };
    }
}

async function checkAllMaps() {
    const mapsWithErrors = [];
    let allMapsOk = true;

    for (const mapId of mapIds) {
        const { allLayersOk, mapTitle, problematicLayers } = await checkSpecificMap(mapId);
        if (!allLayersOk) {
            allMapsOk = false;
            mapsWithErrors.push({ mapTitle, problematicLayers });
        }
        appendToResults("\n" + "=".repeat(50) + "\n", 'separator');
    }

    if (allMapsOk) {
        appendToResults(" ALL MAPS AND LAYERS ARE ACCESSIBLE! :) ", 'success');
    } else {
        appendToResults("!!! ERRORS DETECTED IN THE FOLLOWING MAPS: !!!", 'error');
        for (const { mapTitle, problematicLayers } of mapsWithErrors) {
            appendToResults(`  :${mapTitle}:`, 'map-title');
            for (const layer of problematicLayers) {
                appendToResults(`     ${layer} * `, 'error');
            }
        }
    }
    appendToResults("\n" + "=".repeat(50) + "\n", 'separator');
}

// Make sure to call checkAllMaps() when you want to start the checking process