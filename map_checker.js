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

async function getToken(username, password) {
    const tokenUrl = 'https://ta-muni.maps.arcgis.com/sharing/rest/generateToken';
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
        console.error('Error getting token:', error);
        throw error;
    }
}

let token = '';

async function testService(url) {
    try {
        if (!token) {
            token = await getToken(USERNAME, PASSWORD);
        }
        
        const urlWithToken = `${url}${url.includes('?') ? '&' : '?'}token=${token}`;
        console.log(`Attempting to fetch: ${urlWithToken}`);
        
        const response = await fetch(urlWithToken, { 
            method: 'GET',
            mode: 'cors',
            timeout: 15000 
        });
        
        console.log(`Response status: ${response.status}`);
        console.log(`Response type: ${response.type}`);
        
        const text = await response.text();
        if (text.trim().startsWith('<')) {
            console.error('Received HTML instead of JSON');
            console.error(`HTML content (first 500 characters): ${text.substring(0, 500)}`);
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

    if (!layer.url && !layer.styleUrl) {
        console.log(`Layer without URL:`, layer);
        appendToResults(` - Status: Not checkable (no URL)`, 'warning');
        return false;
    }

    let url;
    if (layer.url) {
        url = layer.url;
    } else if (layer.styleUrl) {
        url = layer.styleUrl;
    } else {
        appendToResults(` - Status: Not checkable (no URL)`, 'warning');
        return false;
    }

    const { isAccessible, result } = await testService(url);
    if (isAccessible) {
        appendToResults(` - Status: Accessible`, 'success');
        return true;
    } else {
        appendToResults(` - Status: Not accessible - Error: ${result}`, 'error');
        console.error(`Error checking layer '${layerTitle}': ${result}`);
        return false;
    }
}

async function checkSpecificMap(mapId) {
    const mapInfo = mapNames[mapId];
    let mapUrl, mapTitle;

    if (typeof mapInfo === 'object') {
        mapUrl = mapInfo.url;
        mapTitle = mapInfo.name;
        // For now, we'll skip checking this map
        appendToResults(`Skipping portal map: ${mapTitle}`, 'important');
        return { allLayersOk: true, mapTitle, problematicLayers: [] };
    } else {
        mapUrl = baseUrl.replace('{mapId}', mapId);
        mapTitle = mapInfo;
    }

    appendToResults(`Fetching JSON data from URL: `, 'important');
    appendToResults(mapUrl, 'url');
    const { isAccessible, result } = await testService(mapUrl);
    if (isAccessible) {
        try {
            const mapData = result;
            appendToResults(`\n`, 'separator');
            appendToResults(`Map Title: `, 'map-title');
            appendToResults(mapTitle, 'important');
            appendToResults(`\n`, 'separator');
            
            let allLayersOk = true;
            const problematicLayers = [];
            
            appendToResults("\nChecking Basemaps:", 'basemap');
            appendToResults('\n'); // Add a line break after "Checking Basemaps"
            const basemaps = mapData.baseMap?.baseMapLayers || [];
            for (const basemap of basemaps) {
                if (!await checkLayer(basemap, "  ")) {
                    allLayersOk = false;
                    problematicLayers.push(`Basemap: ${basemap.title || 'Unnamed Basemap'}`);
                }
            }
            
            appendToResults("\nChecking Operational Layers:", 'operational-layer');
            appendToResults('\n'); // Add a line break after "Checking Operational Layers"
            const operationalLayers = mapData.operationalLayers || [];
            for (const layer of operationalLayers) {
                if (!await checkLayer(layer, "  ")) {
                    allLayersOk = false;
                    problematicLayers.push(layer.title || 'Unnamed Layer');
                }
            }
            
            return { allLayersOk, mapTitle, problematicLayers };
        } catch (error) {
            console.error(`Error parsing map data for ${mapTitle}: ${error}`);
            appendToResults(`Failed to parse map data for ${mapTitle}. Error: ${error}`, 'error');
            appendToResults('\n');
            return { allLayersOk: false, mapTitle, problematicLayers: ['Unable to parse map data'] };
        }
    } else {
        appendToResults(`Failed to fetch web map data for map ID ${mapId}. Error: ${result}`, 'error');
        appendToResults('\n');
        return { allLayersOk: false, mapTitle, problematicLayers: ['Unable to fetch map data'] };
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