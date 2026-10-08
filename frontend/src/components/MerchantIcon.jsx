import { MerchantLogo } from '../utils/subscriptionBrands.jsx'
import { useInstalledAppIcon } from '../utils/appIcon.js'

/**
 * One merchant icon for the whole app: bundled brand logo → icon of an installed app
 * matching `name` (merchant) → one matching `altName` (description) → `fallback`.
 */
export default function MerchantIcon({ brand, name = '', altName = '', size = 40, fallback = null }) {
  const nameIcon = useInstalledAppIcon(brand ? '' : name)
  const altIcon = useInstalledAppIcon(brand || nameIcon ? '' : altName)
  if (brand) return <MerchantLogo brand={brand} size={size} />
  const icon = nameIcon || altIcon
  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        aria-hidden="true"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return fallback
}
