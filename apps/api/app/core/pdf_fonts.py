import os
from typing import Tuple
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_REGISTERED = False
_REGULAR_FONT = "Helvetica"
_BOLD_FONT = "Helvetica-Bold"
_ITALIC_FONT = "Helvetica-Oblique"
_CURRENCY_SYMBOL = "Rs."


def register_pdf_unicode_fonts() -> Tuple[str, str, str, str]:
    """
    Detects, registers, and returns TrueType fonts supporting Unicode currency symbols (₹ - U+20B9).
    Scans common system and bundled paths across Windows, Linux (Docker/Vercel/Debian/Ubuntu), and macOS.

    Returns:
        Tuple[str, str, str, str]: (regular_font_name, bold_font_name, italic_font_name, currency_symbol)
    """
    global _REGISTERED, _REGULAR_FONT, _BOLD_FONT, _ITALIC_FONT, _CURRENCY_SYMBOL

    if _REGISTERED:
        return _REGULAR_FONT, _BOLD_FONT, _ITALIC_FONT, _CURRENCY_SYMBOL

    # Potential candidate families in order of priority: (FamilyName, RegularPath, BoldPath, ItalicPath)
    font_candidates = [
        # Windows standard fonts
        (
            "QB-SegoeUI",
            "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/segoeuib.ttf",
            "C:/Windows/Fonts/segoeuii.ttf",
        ),
        (
            "QB-Arial",
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/ariali.ttf",
        ),
        # Linux (Debian, Ubuntu, Alpine, Docker containers)
        (
            "QB-DejaVuSans",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
        ),
        (
            "QB-LiberationSans",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
        ),
        (
            "QB-FreeSans",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf",
        ),
        # Red Hat / Fedora / CentOS
        (
            "QB-DejaVuSans-RHEL",
            "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf",
            None,
        ),
        # macOS
        (
            "QB-Arial-Mac",
            "/Library/Fonts/Arial.ttf",
            "/Library/Fonts/Arial Bold.ttf",
            "/Library/Fonts/Arial Italic.ttf",
        ),
        (
            "QB-Arial-Mac-System",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
        ),
    ]

    for fam_name, reg_p, bold_p, italic_p in font_candidates:
        if reg_p and os.path.exists(reg_p):
            try:
                reg_name = fam_name
                bold_name = f"{fam_name}-Bold" if bold_p and os.path.exists(bold_p) else reg_name
                italic_name = f"{fam_name}-Italic" if italic_p and os.path.exists(italic_p) else reg_name

                # Register Regular
                if reg_name not in pdfmetrics.getRegisteredFontNames():
                    f_reg = TTFont(reg_name, reg_p)
                    # Verify that font actually supports U+20B9 (₹)
                    if hasattr(f_reg, 'face') and hasattr(f_reg.face, 'charToGlyph'):
                        if 0x20B9 not in f_reg.face.charToGlyph:
                            continue
                    pdfmetrics.registerFont(f_reg)

                # Register Bold
                if bold_name != reg_name and bold_name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont(bold_name, bold_p))

                # Register Italic
                if italic_name != reg_name and italic_name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont(italic_name, italic_p))

                _REGULAR_FONT = reg_name
                _BOLD_FONT = bold_name
                _ITALIC_FONT = italic_name
                _CURRENCY_SYMBOL = "₹"
                _REGISTERED = True
                return _REGULAR_FONT, _BOLD_FONT, _ITALIC_FONT, _CURRENCY_SYMBOL
            except Exception:
                # If loading this candidate failed, attempt next candidate
                continue

    # Safe fallback if environment completely lacks TrueType fonts
    _REGULAR_FONT = "Helvetica"
    _BOLD_FONT = "Helvetica-Bold"
    _ITALIC_FONT = "Helvetica-Oblique"
    _CURRENCY_SYMBOL = "Rs."
    _REGISTERED = True
    return _REGULAR_FONT, _BOLD_FONT, _ITALIC_FONT, _CURRENCY_SYMBOL

