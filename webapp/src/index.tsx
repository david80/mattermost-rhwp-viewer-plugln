import { PluginRegistry, FileInfo } from './types';
import React from 'react';
import { HwpPreviewModal } from './components/HwpPreviewModal';

class HwpViewerPlugin {
  initialize(registry: PluginRegistry) {
    if (registry && registry.registerFilePreviewComponent) {
      registry.registerFilePreviewComponent(
        (fileInfo: FileInfo) => {
          const ext = (fileInfo?.extension || '').toLowerCase();
          return ext === 'hwp' || ext === 'hwpx';
        },
        HwpPreviewModal
      );
    }
  }

  uninitialize() {
    // Cleanup if needed
  }
}

declare global {
  interface Window {
    registerPlugin(id: string, plugin: any): void;
  }
}

window.registerPlugin('mattermost-rhwp-viewer', new HwpViewerPlugin());
