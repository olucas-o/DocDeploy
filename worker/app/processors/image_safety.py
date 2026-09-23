"""Guards against decompression-bomb style images before any decoding work."""

from io import BytesIO

from PIL import Image

# ~64 megapixels: generous for scanned documents while blocking crafted images
# that decode to gigabytes of pixel data from a tiny compressed payload.
DEFAULT_MAX_PIXELS = 64_000_000


def validate_pixel_count(width: int, height: int, max_pixels: int = DEFAULT_MAX_PIXELS) -> None:
    """Reject dimensions that would decode into more than ``max_pixels`` pixels."""
    if width <= 0 or height <= 0:
        raise ValueError("Invalid image dimensions")
    if width * height > max_pixels:
        raise ValueError("Image exceeds the maximum allowed pixel count")


def open_image_safely(content: bytes, max_pixels: int = DEFAULT_MAX_PIXELS) -> Image.Image:
    """Open an image while enforcing the pixel-count guard against bomb attacks.

    Dimensions are checked from the header before Pillow decodes pixel data,
    and ``Image.MAX_IMAGE_PIXELS`` is also lowered so Pillow's own bomb
    protection matches the worker's configured limit.
    """
    previous_limit = Image.MAX_IMAGE_PIXELS
    try:
        Image.MAX_IMAGE_PIXELS = max_pixels
        try:
            with Image.open(BytesIO(content)) as probe:
                validate_pixel_count(probe.width, probe.height, max_pixels)
                probe.load()
                return probe.copy()
        except Image.DecompressionBombError as error:
            raise ValueError("Image exceeds the maximum allowed pixel count") from error
    finally:
        Image.MAX_IMAGE_PIXELS = previous_limit


__all__ = ["DEFAULT_MAX_PIXELS", "open_image_safely", "validate_pixel_count"]
