export interface SidebarScaffoldState {
  readonly title: string;
  readonly description: string;
}

export const DEFAULT_SIDEBAR_SCAFFOLD_STATE: SidebarScaffoldState = {
  title: "Matterhorn",
  description: "Sidebar state mapping and derived view helpers belong here.",
};
