"""Lightweight content-based file type checks, alongside the extension allowlist.

An upload's extension is just a client-supplied string - nothing stops a
file from being named `malware.pdf` while containing anything at all. This
adds a cheap check that the file's actual bytes look like what its
extension claims, without pulling in a full "libmagic" dependency.
"""

_PDF_SIGNATURE = b"%PDF-"
_ZIP_SIGNATURE = b"PK\x03\x04"  # .docx is a zip archive under the hood


def matches_declared_type(ext: str, header: bytes) -> bool:
    """Return whether `header` (the first bytes of an upload) is consistent
    with file extension `ext` (e.g. ".pdf").

    Extensions with no reliable magic number (.txt, .md) always pass - free
    text has no fixed signature to check.
    """
    ext = ext.lower()
    if ext == ".pdf":
        return header.startswith(_PDF_SIGNATURE)
    if ext == ".docx":
        return header.startswith(_ZIP_SIGNATURE)
    return True
