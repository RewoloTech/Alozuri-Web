# Continent mapping

`src/geography.ts` uses Unicode CLDR territory containment, retrieved on 11 November 2026:

https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/territoryContainment.json

The continent groups expand Europe (150), Asia (142), North America (003), South America (005), Africa (002) and Oceania (009). Turkey is assigned to Europe to preserve Alozuri's existing curated destination taxonomy. Unknown and aggregate country codes are not accepted as destinations.

The Unicode license is included in `UNICODE_LICENSE.txt`.
