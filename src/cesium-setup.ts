import * as Cesium from 'cesium';

// Ensure standard Cesium styles and assets are pointed correctly
window.CESIUM_BASE_URL = '/cesium';

// Expose Cesium globally for ol-cesium
(window as any).Cesium = Cesium;
