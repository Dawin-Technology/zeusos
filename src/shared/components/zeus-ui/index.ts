/**
 * Zeus-UI — DawinOS "soft skin" primitives for ZeusOS.
 *
 * Load the CSS once at app boot (we import it from src/index.css):
 *     import './shared/components/zeus-ui/zeus-ui.css';
 *
 * These primitives are opt-in: existing surfaces keep working on the
 * shadcn primitives. New or re-skinned pages adopt the Zeus-UI set
 * for KPI rows, data tables, banners, drawers and dashboards.
 */

export { Sparkline, type SparklineProps } from './Sparkline';
export {
  KPIRow,
  type KPI,
  type KPIRowProps,
  type KPITrend,
} from './KPIRow';
export { Banner, type BannerProps, type BannerTone } from './Banner';
export { Hbars, type HbarsProps, type HbarRow } from './Hbars';
export { SectionCard, type SectionCardProps } from './SectionCard';
export { Drawer, type DrawerProps } from './Drawer';
export {
  DataTable,
  type Column,
  type DataTableProps,
  type FilterSpec,
  type CellType,
} from './DataTable';
export { ModuleHeader, type ModuleHeaderProps, type ModuleTab } from './ModuleHeader';
export {
  KanbanLayout,
  KanbanCard,
  type KanbanColumn,
  type KanbanItem,
  type KanbanLane,
  type KanbanLayoutProps,
} from './kanban/KanbanLayout';
export {
  CalendarLayout,
  CalendarEventPill,
  type CalendarEvent,
  type CalendarLayoutProps,
  type CalendarTone,
  type CalendarView,
} from './calendar/CalendarLayout';
export {
  OrgChartLayout,
  OrgNodeCard,
  type OrgNode,
  type OrgChartLayoutProps,
  type OrgChartOrientation,
} from './org-chart/OrgChartLayout';
export {
  GalleryLayout,
  GalleryTile,
  type GalleryItem,
  type GalleryLayoutProps,
  type GalleryTone,
} from './gallery/GalleryLayout';
export {
  BrandChip,
  MiniBar,
  MoneyCell,
  PersonChip,
  RagBadge,
  RatingStars,
  initialsOf,
  type BrandChipProps,
  type MiniBarProps,
  type MoneyCellProps,
  type PersonChipProps,
  type RagBadgeProps,
  type RatingStarsProps,
  type RagTone,
  type SubBrandId,
} from './cells';
