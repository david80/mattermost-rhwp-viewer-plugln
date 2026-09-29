export interface FileInfo {
  id: string;
  user_id: string;
  post_id: string;
  create_at: number;
  update_at: number;
  delete_at: number;
  name: string;
  extension: string;
  size: number;
  mime_type: string;
  width?: number;
  height?: number;
  has_preview_image?: boolean;
}

export interface PluginRegistry {
  registerFilePreviewComponent(
    override: (fileInfo: FileInfo, post?: any) => boolean,
    component: React.ComponentType<{ fileInfo: FileInfo; post?: any }>
  ): void;
  registerFileDropdownMenuAction?(
    text: string,
    action: (fileInfo: FileInfo) => void,
    filter?: (fileInfo: FileInfo) => boolean
  ): void;
}
