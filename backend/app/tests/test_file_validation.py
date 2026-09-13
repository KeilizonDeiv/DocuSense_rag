from app.core.file_validation import matches_declared_type


def test_pdf_header_matches_pdf_extension():
    assert matches_declared_type(".pdf", b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")


def test_non_pdf_content_rejected_for_pdf_extension():
    assert not matches_declared_type(".pdf", b"just some text pretending to be a pdf")


def test_zip_header_matches_docx_extension():
    assert matches_declared_type(".docx", b"PK\x03\x04\x14\x00\x00\x00\x08\x00")


def test_non_zip_content_rejected_for_docx_extension():
    assert not matches_declared_type(".docx", b"not a zip archive")


def test_txt_and_md_have_no_signature_to_check():
    assert matches_declared_type(".txt", b"anything goes here")
    assert matches_declared_type(".md", b"# even markdown headings")


def test_extension_case_is_ignored():
    assert matches_declared_type(".PDF", b"%PDF-1.4")
