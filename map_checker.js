// Map names and IDs
const mapNames = {
    "3a64f1a338b64c1da39556f363321000": "אפליקציה חיצונית",
    "0e3643433dfd4039b1bd83488c4618dc": "הפקעות מטרו",
    "0171927ba282497aad1579c62b8c95b1": "גבולות עבודה נתע",
    "b5b46be4b36a412f85e712c6a716684e": "מתען 2050",
    "b9926cc754f645a9bb72bdea824f5be9": "אפליקציית סקרי עצים",
    "f3286b9e33a14add8f7c7296fa670caf": "מרחקי השפעה - תמא 70",
    "7e445c19c3964444ad3086ca350359e2": "מגרשים חופפים למסילות צד",
    "9ad9f3c465964920a65b57f000c647f4": { name: "תתל 133 - מסילות 5 ו-6", isPortal: true }
};

const mapIds = Object.keys(mapNames);
const baseUrl = "https://ta-muni.maps.arcgis.com/sharing/rest/content/items/{mapId}/data?f=json";
let token = "";

// Function to get token for Portal maps
async function getToken(username, password) {
    const tokenUrl = "https://gisportal02.tlv.gov.il/portal/sharing/rest/generateToken";
    const params = new URLSearchParams({
        username: username,
        password: password,
        referer: "yourAppURL", // Update with your actual app URL or referer
        f: "json"
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
        console.error("Error fetching token:", error);
        return null;
    }
}

async function testService(url) {
    try {
        const response = await fetch(`${url}?f=json`, { timeout: 15000 });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) {
            return { isAccessible: false, result: data.error.message };
        }
        return { isAccessible: true, result: data };
    } catch (error) {
        return { isAccessible: false, result: error.toString() };
    }
}

async function checkVectorTileLayer(layer, indent = "") {
    const layerTitle = layer.title || 'Unnamed VectorTileLayer';
    appendToResults(`${indent}Checking VectorTileLayer: `, 'vector-tile-layer');
    appendToResults(`${layerTitle}`, 'important');

    const { isAccessible, result } = await testService(layer.styleUrl || `https://tiles.arcgis.com/tiles/PcGFyTym9yKZBRgz/arcgis/rest/services/${layerTitle}/VectorTileServer`);
    if (isAccessible) {
        appendToResults(` - Status: Accessible`, 'success');
    } else {
        appendToResults(` - Status: Not accessible`, 'error');
        appendToResults(` - Error: ${result}`, 'error');
    }
    appendToResults('\n');
    return isAccessible;
}

async function checkLayer(layer, indent = "") {
    const layerTitle = layer.title || `id: ${layer.id || 'Unnamed Layer'}`;
    const layerUrl = layer.url;
    
    if (layer.layerType === "VectorTileLayer") {
        return await checkVectorTileLayer(layer, indent);
    }
    
    if (layer.layers || layer.layerGroups) {
        appendToResults(`${indent}Group: `, 'layer-group');
        appendToResults(`${layerTitle}`);
        appendToResults('\n');
        let allSublayersOk = true;
        const sublayers = (layer.layers || []).concat(layer.layerGroups || []);
        for (const sublayer of sublayers) {
            if (!await checkLayer(sublayer, indent + "  ")) {
                allSublayersOk = false;
            }
        }
        return allSublayersOk;
    } else if (layerUrl) {
        appendToResults(`${indent}Checking Layer: `, 'operational-layer');
        appendToResults(`${layerTitle}`);
        const { isAccessible, result } = await testService(layerUrl);
        if (isAccessible) {
            appendToResults(` - Status: Accessible`, 'success');
        } else {
            appendToResults(` - Status: Not accessible`, 'error');
            appendToResults(` - Error: ${result}`, 'error');
        }
        appendToResults('\n');
        return isAccessible;
    } else {
        appendToResults(`${indent}Layer: `, 'operational-layer');
        appendToResults(`${layerTitle}`);
        appendToResults(` - No URL found. Unable to check accessibility.`, 'warning');
        appendToResults('\n');
        return true;
    }
}

async function checkSpecificMap(mapId) {
    let mapUrl;
    let mapTitle;

    if (typeof mapNames[mapId] === 'object' && mapNames[mapId].isPortal) {
        mapUrl = `https://gisportal02.tlv.gov.il/portal/sharing/rest/content/items/${mapId}/data?f=json&token=${token}`;
        mapTitle = mapNames[mapId].name;
    } else {
        mapUrl = baseUrl.replace('{mapId}', mapId);
        mapTitle = mapNames[mapId] || 'Unnamed Map';
    }

    appendToResults(`Fetching JSON data from URL: `, 'important');
    appendToResults(mapUrl, 'url');
    const { isAccessible, result } = await testService(mapUrl);
    
    if (isAccessible) {
        const mapData = result;
        appendToResults('\n', 'separator');
        appendToResults(`Map Title: `, 'map-title');
        appendToResults(mapTitle, 'important');
        appendToResults('\n', 'separator');
        
        let allLayersOk = true;
        const problematicLayers = [];
        
        appendToResults("\nChecking Basemaps:", 'basemap');
        appendToResults('\n');
        const basemaps = mapData.baseMap?.baseMapLayers || [];
        for (const basemap of basemaps) {
            if (!await checkLayer(basemap, "  ")) {
                allLayersOk = false;
                problematicLayers.push(`Basemap: ${basemap.title || 'Unnamed Basemap'}`);
            }
        }
        
        appendToResults("\nChecking Operational Layers:", 'operational-layer');
        appendToResults('\n');
        const operationalLayers = mapData.operationalLayers || [];
        for (const layer of operationalLayers) {
            if (!await checkLayer(layer, "  ")) {
                allLayersOk = false;
                problematicLayers.push(layer.title || 'Unnamed Layer');
            }
        }
        
        return { allLayersOk, mapTitle, problematicLayers };
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
        try {
            const { allLayersOk, mapTitle, problematicLayers } = await checkSpecificMap(mapId);
            if (!allLayersOk) {
                allMapsOk = false;
                mapsWithErrors.push({ mapTitle, problematicLayers });
            }
        } catch (error) {
            console.error(`Error checking map ${mapId}:`, error);
            allMapsOk = false;
            mapsWithErrors.push({ mapTitle: mapNames[mapId] || 'Unnamed Map', problematicLayers: ['Error checking map'] });
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

// Main execution
(async () => {
    token = await getToken('x39677554', 'Lir728t!'); 
    await checkAllMaps();
})();
