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

async function testService(url) {
    try {
        const response = await fetch(url, { 
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
            timeout: 15000 
        });
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
    const layerTitle = layer.title || `id: ${layer.id || 'Unnamed Layer'}`;
    const layerUrl = layer.url;
    
    if (layer.layerType === "VectorTileLayer") {
        return await checkVectorTileLayer(layer, indent);
    }
    
    if (layer.layers || layer.layerGroups) {
        appendToResults(`${indent}Group: `, 'layer-group');
        appendToResults(`'${layerTitle}'`); // Removed 'important' class
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
        appendToResults(`'${layerTitle}'`); // Removed 'important' class
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
        appendToResults(`'${layerTitle}'`); // Removed 'important' class
        appendToResults(` - No URL found. Unable to check accessibility.`, 'warning');
        appendToResults('\n');
        return true;
    }
}

async function checkSpecificMap(mapId) {
    const mapInfo = mapNames[mapId];
    const mapUrl = typeof mapInfo === 'object' ? mapInfo.url : baseUrl.replace('{mapId}', mapId);
    const mapTitle = typeof mapInfo === 'object' ? mapInfo.name : mapInfo;

    appendToResults(`Fetching JSON data from URL: `, 'important');
    appendToResults(mapUrl, 'url');
    const { isAccessible, result } = await testService(mapUrl);
    if (isAccessible) {
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
    } else {
        appendToResults(`Failed to fetch web map data for map ID ${mapId}. Error: ${result}`, 'error');
        appendToResults('\n');
        return { allLayersOk: false, mapTitle, problematicLayers: [] };
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