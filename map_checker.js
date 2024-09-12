// Map names and IDs
const mapNames = {
    // Example entries, replace with actual map IDs and names
    "0e3643433dfd4039b1bd83488c4618dc": "הפקעות מטרו",
    "0171927ba282497aad1579c62b8c95b1": "גבולות עבודה נתע",
    // "3a64f1a338b64c1da39556f363321000": "אפליקציה חיצונית",
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
    const styleUrl = layer.styleUrl;

    appendToResults(`${indent}Checking VectorTileLayer: `, 'vector-tile-layer');
    appendToResults(`'${layerTitle}'`, 'important');

    if (styleUrl) {
        appendToResults(` (StyleURL: `, 'vector-tile-layer');
        appendToResults(styleUrl, 'url');
        appendToResults(`)`, 'vector-tile-layer');
        const { isAccessible, result } = await testService(styleUrl);
        if (isAccessible) {
            appendToResults(`\n${indent}  Status: Accessible`, 'success');
            return true;
        } else {
            appendToResults(`\n${indent}  Status: Not accessible`, 'error');
            appendToResults(`\n${indent}  Error: ${result}`, 'error');
            return false;
        }
    } else {
        const serviceUrl = `https://tiles.arcgis.com/tiles/PcGFyTym9yKZBRgz/arcgis/rest/services/${layerTitle}/VectorTileServer`;
        appendToResults(`\n${indent}  No StyleURL found. Checking service URL: `, 'warning');
        appendToResults(serviceUrl, 'url');
        const { isAccessible, result } = await testService(serviceUrl);
        if (isAccessible) {
            appendToResults(`\n${indent}  Status: Accessible`, 'success');
            return true;
        } else {
            appendToResults(`\n${indent}  Status: Might not be accessible`, 'warning');
            appendToResults(`\n${indent}  Error: ${result}`, 'warning');
            return false;
        }
    }
}

async function checkLayer(layer, indent = "") {
    const layerTitle = layer.title || `id: ${layer.id || 'Unnamed Layer'}`;
    const layerUrl = layer.url;
    
    if (layer.layerType === "VectorTileLayer") {
        return await checkVectorTileLayer(layer, indent);
    }
    
    if (layer.layers || layer.layerGroups) {
        appendToResults(`${indent}Group: `, 'layer-group');
        appendToResults(`'${layerTitle}'`, 'important');
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
        appendToResults(`${indent}Layer '${layerTitle}' - No URL found. Unable to check accessibility.`);
        return true;  // We can't check it, but we don't want to flag it as an error
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