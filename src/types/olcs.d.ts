// src/types/olcs.d.ts
declare module 'olcs/OLCesium' {
  import type { Map as OlMap } from 'ol';
  class OLCesium {
    constructor(options: { map: OlMap });
    setEnabled(enabled: boolean): this;
    getEnabled(): boolean;
    getCesiumScene(): any;
    destroy(): void;
  }
  export default OLCesium;
}
