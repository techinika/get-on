# Editor documentation

## Dark and light mode (future plugin)
The site design system is prepared for a future "dark-mode" plugin:
- All colours in the renderer come from --s-* variables. No fixed hex/rgb outside tokens in renderer components.
- project_settings.theme has colorMode: 'light' | 'dark' | 'auto' (default 'light'). Only 'light' is honoured now.
- Palettes may include an optional dark object; it is ignored for now.
- Renderer root sets data-color-mode="light" and color-scheme: light; tokens are scoped to .gs-root so overrides can be added later.
- project_settings has logo_dark_url as nullable (unused now).
- Plugin "dark-mode" is registered as status 'planned' conceptually; not shown in UI.

## Fonts
Site fonts are loaded with next/font/google. Publishing will later need self-hosted, subsetted font files.
