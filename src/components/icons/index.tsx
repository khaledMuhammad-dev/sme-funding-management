import { MorphIcon, type MorphIconProps, type MorphPaths } from './MorphIcon'
import * as paths from './paths'

export { MorphIcon }
export type { MorphIconProps, MorphPaths }
export { statusIcons } from './paths'

// The bell is hand-built rather than a `makeIcon` wrapper: its body and clapper
// are separate paths so they can swing against each other.
export { BellIcon, type BellIconProps } from './BellIcon'

type IconProps = Omit<MorphIconProps, 'paths'>

/** Thin wrappers so call sites read `<HomeIcon active />` instead of passing paths. */
function makeIcon(iconPaths: MorphPaths) {
  return function Icon(props: IconProps) {
    return <MorphIcon paths={iconPaths} {...props} />
  }
}

export const HomeIcon = makeIcon(paths.homeIcon)
export const ApplicationsIcon = makeIcon(paths.applicationsIcon)
export const InterviewIcon = makeIcon(paths.interviewIcon)
export const ContractIcon = makeIcon(paths.contractIcon)
export const DisbursementIcon = makeIcon(paths.disbursementIcon)
export const FollowUpIcon = makeIcon(paths.followUpIcon)
export const ReportsIcon = makeIcon(paths.reportsIcon)
export const SettingsIcon = makeIcon(paths.settingsIcon)
export const DashboardIcon = makeIcon(paths.dashboardIcon)
export const UserIcon = makeIcon(paths.userIcon)
export const SearchIcon = makeIcon(paths.searchIcon)
export const MoonSunIcon = makeIcon(paths.moonSunIcon)
export const LangIcon = makeIcon(paths.langIcon)
export const CheckIcon = makeIcon(paths.checkIcon)
export const XIcon = makeIcon(paths.xIcon)
export const ClockIcon = makeIcon(paths.clockIcon)
export const DocumentIcon = makeIcon(paths.documentIcon)
export const UploadIcon = makeIcon(paths.uploadIcon)
export const AlertIcon = makeIcon(paths.alertIcon)
export const MoneyIcon = makeIcon(paths.moneyIcon)
export const ChartIcon = makeIcon(paths.chartIcon)
export const ArrowIcon = makeIcon(paths.arrowIcon)
export const PlusIcon = makeIcon(paths.plusIcon)

/** Renders the icon that belongs to an application status. */
export function StatusIcon({ status, ...props }: IconProps & { status: string }) {
  return <MorphIcon paths={paths.statusIcons[status] ?? paths.clockIcon} {...props} />
}
