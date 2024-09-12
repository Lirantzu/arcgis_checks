// Map names and IDs
const mapNames = {
    "0e3643433dfd4039b1bd83488c4618dc": "הפקעות מטרו",
    "0171927ba282497aad1579c62b8c95b1": "גבולות עבודה נתע",
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
        appendToResults(`'${layerTitle}'\n`, 'important');
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
        appendToResults(`'${layerTitle}'`, 'important');
        const { isAccessible, result } = await testService(layerUrl);
        if (isAccessible) {
            appendToResults(` - Status: Accessible`, 'success');
        } else {
            appendToResults(` - Status: Not accessible`, 'error');
            appendToResults(` - Error: ${result}`, 'error');
        }
        appendToResults('\n'); // Add a line break after each layer check
        return isAccessible;
    } else {
        appendToResults(`${indent}Layer: `, 'operational-layer');
        appendToResults(`'${layerTitle}'`, 'important');
        appendToResults(` - No URL found. Unable to check accessibility.\n`, 'warning');
        return true;
    }
}

async function checkSpecificMap(mapId) {
    const mapUrl = baseUrl.replace('{mapId}', mapId);
    appendToResults(`Fetching JSON data from URL: `, 'important');
    appendToResults(mapUrl, 'url');
    const { isAccessible, result } = await testService(mapUrl);
    if (isAccessible) {
        const mapData = result;
        const mapTitle = mapNames[mapId] || 'Unnamed Map';
        appendToResults(`\nMap Title: `, 'map-title');
        appendToResults(mapTitle, 'important');
        appendToResults('\n'); // Add a line break after the map title
        
        let allLayersOk = true;
        const problematicLayers = [];
        
        appendToResults("Checking Basemaps:", 'basemap');
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
        appendToResults('\n'); // Add a line break after the error message
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