// src/App.tsx
import React, { useEffect, useRef } from "react";
import "./App.css"; // Build fix: Import component styles
import "ol/ol.css";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";

import OLCesium from "olcs/OLCesium";

import { defaults as defaultControls, ScaleLine, Control } from "ol/control";
import MousePosition from "ol/control/MousePosition";
import { fromLonLat, toLonLat } from "ol/proj";

const MapContainer: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);

  const olMap = useRef<Map | null>(null);
  const ol3d = useRef<OLCesium | null>(null);
  const pointPrimitives = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    /* -------------------------------
       Zoom Indicator (Bottom-Left)
    -------------------------------- */
    const zoomControl = new Control({
      element: (() => {
        const el = document.createElement("div");
        el.className = "ol-zoom-indicator";
        el.innerText = "Zoom: 2.00"; // Default
        zoomRef.current = el;
        return el;
      })(),
    });

    /* -------------------------------
       Location Layer & Source
    -------------------------------- */
    const locationSource = new VectorSource();
    const locationLayer = new VectorLayer({
      source: locationSource,
      style: new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({ color: '#3399CC' }),
          stroke: new Stroke({ color: '#fff', width: 2 })
        })
      })
    });
    locationLayer.set('altitudeMode', 'clampToGround');

    /* -------------------------------
       Locate Me Control
    -------------------------------- */
    const locateControl = new Control({
      element: (() => {
        const button = document.createElement("button");
        button.innerHTML = "📍";
        button.title = "Go to my location";
        button.className = "ol-control-button";

        button.addEventListener("click", () => {
          if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              // Convert coord from [Lon, Lat] (EPSG:4326) to Map Projection (EPSG:3857)
              const coords = fromLonLat([pos.coords.longitude, pos.coords.latitude]);

              // Add a marker
              const feature = new Feature({
                geometry: new Point(coords)
              });
              feature.set('altitudeMode', 'clampToGround');

              locationSource.clear();
              locationSource.addFeature(feature);

              if (olMap.current) {
                const view = olMap.current.getView();
                view.animate({
                  center: coords,
                  zoom: 14,
                  duration: 2000,
                });
                // Also fly Cesium camera if 3D is enabled
                if (ol3d.current && ol3d.current.getEnabled()) {
                  const scene = ol3d.current.getCesiumScene();
                  const Cesium = (window as any).Cesium;
                  const cartesian = Cesium.Cartesian3.fromDegrees(pos.coords.longitude, pos.coords.latitude, 1000);
                  scene.camera.flyTo({
                    destination: cartesian,
                    duration: 2
                  });

                  // Add Cesium Point Primitive for 3D visibility
                  if (!pointPrimitives.current) {
                    pointPrimitives.current = scene.primitives.add(new Cesium.PointPrimitiveCollection());
                  }
                  pointPrimitives.current.removeAll();
                  pointPrimitives.current.add({
                    position: Cesium.Cartesian3.fromDegrees(pos.coords.longitude, pos.coords.latitude),
                    color: Cesium.Color.fromCssColorString('#3399CC'),
                    pixelSize: 10,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY // Always render on top
                  });
                }
              }
            },
            () => {
              alert("Unable to retrieve your location");
            }
          );
        });

        button.className = "ol-control-button";

        const el = document.createElement("div");
        el.className = "ol-unselectable ol-control ol-locate";
        el.appendChild(button);
        return el;
      })(),
    });

    /* -------------------------------
       3D Toggle Control
    -------------------------------- */
    const toggle3dControl = new Control({
      element: (() => {
        const button = document.createElement("button");
        button.innerHTML = "3D";
        button.title = "Toggle 2D/3D";
        button.className = "ol-control-button font-bold";
        button.addEventListener('click', () => {
          if (ol3d.current) {
            const enabled = !ol3d.current.getEnabled();
            ol3d.current.setEnabled(enabled);
            button.innerHTML = enabled ? "2D" : "3D";
            button.title = enabled ? "Switch to 2D" : "Switch to 3D";
          }
        });

        const el = document.createElement("div");
        el.className = "ol-unselectable ol-control ol-toggle-3d";
        el.appendChild(button);
        return el;
      })()
    });


    /* -------------------------------
       2D OpenLayers Map
    -------------------------------- */
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        locationLayer
      ],
      view: new View({
        center: [0, 0], // Longitude, Latitude
        zoom: 2,
      }),
      controls: defaultControls({ zoom: true }).extend([
        new ScaleLine({
          units: "metric",
          bar: true,
          steps: 4,
          text: true,
          minWidth: 140,
        }),
        new MousePosition({
          coordinateFormat: (coord) => {
            if (!coord) return "";
            // Coord is in EPSG:3857, convert back to LonLat for display
            const [lon, lat] = toLonLat(coord);
            return `Lon: ${lon.toFixed(4)} , Lat: ${lat.toFixed(4)}`;
          },
          projection: "EPSG:3857",
          className: "ol-mouse-position custom-mouse-position",
          target: undefined,
        }),
        zoomControl,
        locateControl,
        toggle3dControl
      ]),
    });

    olMap.current = map;

    /* -------------------------------
       Zoom Level Sync
    -------------------------------- */
    const view = map.getView();
    const updateZoom = () => {
      if (zoomRef.current) {
        zoomRef.current.innerText = `Zoom: ${view.getZoom()?.toFixed(2)}`;
      }
    };
    updateZoom();
    view.on("change:resolution", updateZoom);

    /* -------------------------------
       OL-Cesium Enablement
    -------------------------------- */
    const ol3dInstance = new OLCesium({ map });
    ol3dInstance.setEnabled(true);
    ol3d.current = ol3dInstance;

    /* -------------------------------
       Cleanup Governance
    -------------------------------- */
    return () => {
      view.un("change:resolution", updateZoom);

      if (ol3d.current) {
        try {
          ol3d.current.setEnabled(false);
          // Only call destroy if it exists (safe check) to prevent TypeErrors, though we added it to d.ts
          // The olcs library might throw if destroyed incorrectly or already destroyed.
          // (ol3d.current as any).destroy?.(); 
        } catch (e) {
          console.warn("Error cleaning up OLCesium:", e);
        }
        ol3d.current = null;
      }

      if (olMap.current) {
        olMap.current.setTarget(undefined);
        olMap.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    />
  );
};

export default MapContainer;