// Map names and IDs
const mapNames = {
    // Example entries, replace with actual map IDs and names
    // "0e3643433dfd4039b1bd83488c4618dc": "הפקעות מטרו",
    // "0171927ba282497aad1579c62b8c95b1": "גבולות עבודה נתע",
    "3a64f1a338b64c1da39556f363321000": "אפליקציה חיצונית",
};

const mapIds = Object.keys(mapNames);
const baseUrl = "https://ta-muni.maps.arcgis.com/sharing/rest/content/items/{mapId}/data?f=json";

// Helper function to reverse Hebrew text
function reverseText(text) {
    return /[\u0590-\u05FF]/.test(text) ? text.split('').reverse().join('') : text;
}

// Function to test if a service is accessible
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

// Function to check a layer or group layer
async function checkLayer(layer, indent = "") {
    const layerTitle = layer.title || `id: ${layer.id || 'Unnamed Layer'}`;
    const layerUrl = layer.url;
    let message = "";

    if (layer.layers || layer.layerGroups) {  // This is a group layer
        message += `${indent}Group: '${reverseText(layerTitle)}'<br>`;
        const sublayers = (layer.layers || []).concat(layer.layerGroups || []);
        const results = await Promise.all(sublayers.map(sublayer => checkLayer(sublayer, indent + "&nbsp;&nbsp;")));
        return { isAccessible: results.every(r => r.isAccessible), message: message + results.map(r => r.message).join('') };
    } else if (layerUrl) {
        const { isAccessible, result } = await testService(layerUrl);
        if (isAccessible) {
            message += `${indent}Layer '${reverseText(layerTitle)}' is accessible and valid.<br>`;
            return { isAccessible: true, message };
        } else {
            message += `${indent}Layer '${reverseText(layerTitle)}' is not accessible. Error: ${result} &lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt; Error<br>`;
            return { isAccessible: false, message };
        }
    } else {
        message += `${indent}Layer '${reverseText(layerTitle)}' - No URL found for the layer. &lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt; Error<br>`;
        return { isAccessible: false, message };
    }
}

// Function to check a specific map
async function checkSpecificMap(mapId) {
    const mapUrl = baseUrl.replace('{mapId}', mapId);
    let message = `Fetching JSON data from URL: ${mapUrl}<br>`;
    const { isAccessible, result } = await testService(mapUrl);
    
    if (isAccessible) {
        const mapData = result;
        const mapTitle = mapNames[mapId] || 'Unnamed Map';
        message += `<br>Map Title: ${reverseText(mapTitle)}<br>`;
        
        let allLayersOk = true;
        
        // Check basemaps
        const basemaps = mapData.baseMap?.baseMapLayers || [];
        message += "<br>Checking Basemaps:<br>";
        for (const basemap of basemaps) {
            const result = await checkLayer(basemap, "&nbsp;&nbsp;");
            allLayersOk = allLayersOk && result.isAccessible;
            message += result.message;
        }
        
        // Check operational layers
        message += "<br>Checking Operational Layers:<br>";
        const operationalLayers = mapData.operationalLayers || [];
        for (const layer of operationalLayers) {
            const result = await checkLayer(layer);
            allLayersOk = allLayersOk && result.isAccessible;
            message += result.message;
        }
        
        return { allLayersOk, mapTitle, message };
    } else {
        message += `Failed to fetch web map data for map ID ${mapId}. Error: ${result}<br>`;
        return { allLayersOk: false, mapTitle: mapNames[mapId] || 'Unnamed Map', message };
    }
}

// Main function to check all maps
async function checkAllMaps() {
    const results = [];
    let allMapsOk = true;

    for (const mapId of mapIds) {
        const result = await checkSpecificMap(mapId);
        results.push(result);
        if (!result.allLayersOk) {
            allMapsOk = false;
        }
    }

    let finalMessage = "<hr>";
    if (allMapsOk) {
        finalMessage += "<h3 style='color: green;'>✅ ALL MAPS AND LAYERS ARE ACCESSIBLE! ✅</h3>";
    } else {
        finalMessage += "<h3 style='color: red;'>❌ ERRORS DETECTED IN THE FOLLOWING MAPS: ❌</h3>";
        results.forEach(result => {
            if (!result.allLayersOk) {
                finalMessage += `<h4>${reverseText(result.mapTitle)}:</h4>`;
                finalMessage += result.message;
            }
        });
    }
    finalMessage += "<hr>";

    // Update the results widget in the Experience Builder app
    const resultsWidget = document.getElementById('resultsWidget');
    if (resultsWidget) {
        resultsWidget.innerHTML = finalMessage;
    } else {
        alert("Results widget not found. Please check the browser console for results.");
        console.log(finalMessage);
    }
}

// Run the check when the script is loaded
checkAllMaps().catch(error => console.error("An error occurred:", error));
