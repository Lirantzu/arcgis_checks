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

async function checkLayer(layer, indent = "") {
    const layerTitle = layer.title || `id: ${layer.id || 'Unnamed Layer'}`;
    const layerUrl = layer.url;
    
    if (layer.layers || layer.layerGroups) {  // This is a group layer
        appendToResults(`<pre>${indent}Group: '${layerTitle}'</pre>`);
        let allSublayersOk = true;
        const sublayers = (layer.layers || []).concat(layer.layerGroups || []);
        for (const sublayer of sublayers) {
            if (!await checkLayer(sublayer, indent + "&nbsp;&nbsp;")) {
                allSublayersOk = false;
            }
        }
        return allSublayersOk;
    } else if (layerUrl) {
        const { isAccessible, result } = await testService(layerUrl);
        if (isAccessible) {
            appendToResults(`<pre>${indent}Layer '${layerTitle}' is accessible and valid.</pre>`);
            return true;
        } else {
            appendToResults(`<pre>${indent}Layer '${layerTitle}' is not accessible. Error: ${result}      <<<<<<<<<< Error</pre>`);
            return false;
        }
    } else {
        appendToResults(`<pre>${indent}Layer '${layerTitle}' - No URL found for the layer.      <<<<<<<<<< Error</pre>`);
        return false;
    }
}

async function checkSpecificMap(mapId) {
    const mapUrl = baseUrl.replace('{mapId}', mapId);
    appendToResults(`<pre>Fetching JSON data from URL: ${mapUrl}</pre>`);
    const { isAccessible, result } = await testService(mapUrl);
    if (isAccessible) {
        const mapData = result;
        const mapTitle = mapNames[mapId] || 'Unnamed Map';
        appendToResults(`<pre><span class="rtl">Map Title: ${mapTitle}</span></pre>`);
        
        let allLayersOk = true;
        const problematicLayers = [];
        
        // Check basemaps
        const basemaps = mapData.baseMap?.baseMapLayers || [];
        appendToResults("<pre>Checking Basemaps:</pre>");
        for (const basemap of basemaps) {
            if (!await checkLayer(basemap, "&nbsp;&nbsp;")) {
                allLayersOk = false;
                problematicLayers.push(`Basemap: ${basemap.title || 'Unnamed Basemap'}`);
            }
        }
        
        // Check operational layers
        appendToResults("<pre>Checking Operational Layers:</pre>");
        const operationalLayers = mapData.operationalLayers || [];
        for (const layer of operationalLayers) {
            if (!await checkLayer(layer, "&nbsp;&nbsp;")) {
                allLayersOk = false;
                problematicLayers.push(layer.title || 'Unnamed Layer');
            }
        }
        
        return { allLayersOk, mapTitle, problematicLayers };
    } else {
        appendToResults(`<pre>Failed to fetch web map data for map ID ${mapId}. Error: ${result}</pre>`);
        return { allLayersOk: false, mapTitle: mapNames[mapId] || 'Unnamed Map', problematicLayers: [] };
    }
}

function appendToResults(text) {
    const resultsElement = document.getElementById('results');
    if (resultsElement) {
        resultsElement.innerHTML += text;
        resultsElement.scrollTop = resultsElement.scrollHeight; // Auto-scroll to bottom
    } else {
        console.log(text);
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

    appendToResults("<pre>" + "=".repeat(50) + "</pre>");
    if (allMapsOk) {
        appendToResults("<pre> ALL MAPS AND LAYERS ARE ACCESSIBLE! :) </pre>");
    } else {
        appendToResults("<pre>!!! ERRORS DETECTED IN THE FOLLOWING MAPS: !!!</pre>");
        for (const { mapTitle, problematicLayers } of mapsWithErrors) {
            appendToResults(`<pre><span class="rtl">  :${mapTitle}:</span></pre>`);
            for (const layer of problematicLayers) {
                appendToResults(`<pre><span class="rtl">     ${layer} * </span></pre>`);
            }
        }
    }
    appendToResults("<pre>" + "=".repeat(50) + "</pre>");
}

function checkMaps() {
    document.getElementById('results').innerHTML = '';
    checkAllMaps().catch(error => {
        console.error("An error occurred:", error);
        appendToResults("<pre>An error occurred while checking maps: " + error.message + "</pre>");
    });
}
