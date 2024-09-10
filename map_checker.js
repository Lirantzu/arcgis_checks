// Map names and IDs
const mapNames = {
    // Example entries, replace with actual map IDs and names
    // "0e3643433dfd4039b1bd83488c4618dc": "הפקעות מטרו",
    // "0171927ba282497aad1579c62b8c95b1": "גבולות עבודה נתע",
    "3a64f1a338b64c1da39556f363321000": "אפליקציה חיצונית",
};

const mapIds = Object.keys(mapNames);
const baseUrl = "https://ta-muni.maps.arcgis.com/sharing/rest/content/items/{mapId}/data?f=json";

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

function appendToResults(text) {
    if (window.appendToResults) {
        window.appendToResults(text);
    } else {
        console.log(text);
    }
}

async function checkLayer(layer, indent = "") {
    const layerTitle = layer.title || `id: ${layer.id || 'Unnamed Layer'}`;
    const layerUrl = layer.url;
    
    if (layer.layers || layer.layerGroups) {  // This is a group layer
        appendToResults(`${indent}Group: '${layerTitle}'`);
        let allSublayersOk = true;
        const sublayers = (layer.layers || []).concat(layer.layerGroups || []);
        for (const sublayer of sublayers) {
            if (!await checkLayer(sublayer, indent + "  ")) {
                allSublayersOk = false;
            }
        }
        return allSublayersOk;
    } else if (layerUrl) {
        const { isAccessible, result } = await testService(layerUrl);
        if (isAccessible) {
            appendToResults(`${indent}Layer '${layerTitle}' is accessible and valid.`);
            return true;
        } else {
            appendToResults(`${indent}Layer '${layerTitle}' is not accessible. Error: ${result}      <<<<<<<<<< Error`);
            return false;
        }
    } else {
        appendToResults(`${indent}Layer '${layerTitle}' - No URL found for the layer.      <<<<<<<<<< Error`);
        return false;
    }
}

async function checkSpecificMap(mapId) {
    const mapUrl = baseUrl.replace('{mapId}', mapId);
    appendToResults(`Fetching JSON data from URL: ${mapUrl}`);
    const { isAccessible, result } = await testService(mapUrl);
    if (isAccessible) {
        const mapData = result;
        const mapTitle = mapNames[mapId] || 'Unnamed Map';
        appendToResults(`Map Title: ${mapTitle}`);
        
        let allLayersOk = true;
        const problematicLayers = [];
        
        // Check basemaps
        const basemaps = mapData.baseMap?.baseMapLayers || [];
        appendToResults("Checking Basemaps:");
        for (const basemap of basemaps) {
            if (!await checkLayer(basemap, "  ")) {
                allLayersOk = false;
                problematicLayers.push(`Basemap: ${basemap.title || 'Unnamed Basemap'}`);
            }
        }
        
        // Check operational layers
        appendToResults("Checking Operational Layers:");
        const operationalLayers = mapData.operationalLayers || [];
        for (const layer of operationalLayers) {
            if (!await checkLayer(layer, "  ")) {
                allLayersOk = false;
                problematicLayers.push(layer.title || 'Unnamed Layer');
            }
        }
        
        return { allLayersOk, mapTitle, problematicLayers };
    } else {
        appendToResults(`Failed to fetch web map data for map ID ${mapId}. Error: ${result}`);
        return { allLayersOk: false, mapTitle: mapNames[mapId] || 'Unnamed Map', problematicLayers: [] };
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
    }

    appendToResults("\n" + "=".repeat(50));
    if (allMapsOk) {
        appendToResults(" ALL MAPS AND LAYERS ARE ACCESSIBLE! :) ");
    } else {
        appendToResults("!!! ERRORS DETECTED IN THE FOLLOWING MAPS: !!!");
        for (const { mapTitle, problematicLayers } of mapsWithErrors) {
            appendToResults(`  :${mapTitle}:`);
            for (const layer of problematicLayers) {
                appendToResults(`     ${layer} * `);
            }
        }
    }
    appendToResults("=".repeat(50) + "\n");
}

// This function is called from the HTML file
function checkMaps() {
    checkAllMaps().catch(error => {
        console.error("An error occurred:", error);
        appendToResults("An error occurred while checking maps: " + error.message);
    });
}
