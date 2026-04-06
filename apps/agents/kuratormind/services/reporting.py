from fpdf import FPDF  # type: ignore
from datetime import datetime
import re
from typing import List, Dict, Any
from kuratormind.services.security import decrypt_pii

class KuratorReport(FPDF):
    def __init__(self, case_metadata: Dict[str, Any] | None = None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.footnotes: List[str] = []
        self.case_metadata = case_metadata or {}
        # Standard fonts
        
    def render_certificate_page(self):
        """Adds a professional cover page (Forensic Certificate of Authenticity)."""
        self.add_page()
        
        # 1. Branding Header
        self.set_y(40)
        self.set_font('helvetica', 'B', 24)
        self.set_text_color(41, 121, 255) # accent-blue
        self.cell(0, 20, 'FORENSIC CERTIFICATE', align='C', ln=True)
        self.set_font('helvetica', 'B', 16)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, 'OF AUTHENTICITY', align='C', ln=True)
        
        # 2. Case Details Box
        self.set_y(100)
        self.set_fill_color(245, 247, 250)
        self.set_draw_color(230, 230, 230)
        self.rect(20, 100, 170, 80, style='FD')
        
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(30, 30, 30)
        self.set_xy(30, 110)
        self.cell(0, 10, f"CASE NAME: {self.case_metadata.get('name', 'N/A').upper()}", ln=True)
        self.set_x(30)
        self.cell(0, 10, f"CASE NUMBER: {self.case_metadata.get('case_number', 'N/A')}", ln=True)
        self.set_x(30)
        debtor = decrypt_pii(self.case_metadata.get('debtor_entity', 'N/A'))
        self.cell(0, 10, f"DEBTOR ENTITY: {debtor}", ln=True)
        self.set_x(30)
        self.cell(0, 10, f"COURT JURISDICTION: {self.case_metadata.get('court_name', 'COURT OF COMMERCE')}", ln=True)
        self.set_x(30)
        self.cell(0, 10, f"GENERATED AT: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True)
        
        # 3. AI Grounding Disclaimer
        self.set_y(200)
        self.set_font('helvetica', 'I', 9)
        self.set_text_color(150, 150, 150)
        disclaimer = (
            "This document was synthesized by the KuratorMind AI Multi-Agent Swarm. "
            "All findings are grounded in the uploaded case documents through RAG (Retrieval-Augmented Generation). "
            "Forensic integrity is maintained via automated OCR confidence scoring and citation mapping. "
            "Usage of this report in Indonesian Courts is subject to UU 37/2004 and formal Kurator verification."
        )
        self.multi_cell(0, 5, self._clean_text(disclaimer), align='C')
        
        # 4. Seal-like graphic (bottom right)
        self.set_y(250)
        self.set_font('helvetica', 'B', 8)
        self.set_text_color(41, 121, 255)
        self.cell(0, 10, self._clean_text("[ VERIFIED FORENSIC OUTPUT / KM-AI-2026 ]"), align='R')

    def _clean_text(self, text: str) -> str:
        """Sanitises text for FPDF to avoid Unicode encoding errors with standard fonts."""
        replacements = {
            '—': '-', '–': '-',
            '‘': "'", '’': "'",
            '“': '"', '”': '"',
            '•': '*', '●': '*', '▪': '*', '▫': '*', '◦': '*',
            '\u2013': '-', '\u2014': '-',
            '\u2018': "'", '\u2019': "'",
            '\u201c': '"', '\u201d': '"',
            '\u2022': '*'
        }
        for old, new in replacements.items():
            text = text.replace(old, new)
        return text

    def header(self):
        # Header with professional branding
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(41, 121, 255) # accent-blue
        self.cell(0, 10, 'KURATORMIND AI - FORENSIC WORKSPACE', border=False, align='L')
        
        self.set_font('helvetica', 'B', 9)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'VERIFIED: {datetime.now().strftime("%Y-%m-%d")}', border=False, align='R')
        
        # Subtle Blue Ribbon
        self.set_draw_color(41, 121, 255)
        self.line(10, 22, 200, 22)
        self.ln(15)
        
        # Forensic Watermark (Very Subtle)
        self.set_font('helvetica', 'B', 45)
        self.set_text_color(245, 245, 245)
        # Position watermark centrally
        self.rotate(45, self.w/2, self.h/2)
        self.text(self.w/6, self.h/2, "PROBATIVE FORENSIC EVIDENCE")
        self.rotate(0)

    def footer(self):
        # Position at 1.5 cm from bottom
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        
        # Line above footer
        self.set_draw_color(230, 230, 230)
        self.line(10, self.h - 20, 200, self.h - 20)
        
        # Left: Page Number
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', align='L')
        # Center: Tech Tag
        self.set_x(10)
        self.cell(0, 10, 'Generated via KuratorMind Multi-Agent Swarm', align='C')
        # Right: Legal Notice
        self.cell(0, 10, self._clean_text('Strictly Confidential - Forensic Use'), align='R')

    def add_footnote(self, text: str):
        if text not in self.footnotes:
            self.footnotes.append(text)
        return self.footnotes.index(text) + 1

    def render_footnotes(self):
        if not self.footnotes:
            return
        
        self.add_page()
        self.set_font('helvetica', 'B', 14)
        self.set_text_color(41, 121, 255)
        self.cell(0, 10, 'SOURCES & CITATIONS (FOOTNOTES)', ln=True)
        self.ln(5)
        
        self.set_font('helvetica', '', 9)
        self.set_text_color(50, 50, 50)
        for i, note in enumerate(self.footnotes, 1):
            self.multi_cell(0, 6, f'[{i}] {note}', border=0)
            self.ln(2)

    def render_table(self, header, data):
        """Standardised table renderer for creditor lists with enhanced styling."""
        self.set_font('helvetica', 'B', 9)
        self.set_fill_color(240, 244, 250) # Light blue header bg
        self.set_text_color(41, 121, 255) # Blue headers
        self.set_draw_color(220, 225, 230) # Soft borders
        
        # Calculate column width
        col_width = (self.w - 2 * self.l_margin) / len(header)
        
        # Header
        for col in header:
            # We use multi_cell behavior for headers inside cells by using cell height logic
            self.cell(col_width, 12, col.upper(), border=1, fill=True, align='C')
        self.ln()
        
        # Data
        self.set_font('helvetica', '', 9)
        self.set_text_color(40, 40, 40)
        for i, row in enumerate(data):
            # Zebra striping
            fill = i % 2 == 1
            if fill:
                self.set_fill_color(252, 253, 255)
            else:
                self.set_fill_color(255, 255, 255)
            
            # Row height
            row_h = 10
            for item in row:
                val = str(item)
                # Truncate if too long to prevent row overlap (basic behavior)
                if len(val) > 40: val = val[:37] + "..."
                self.cell(col_width, row_h, val, border=1, fill=True, align='L')
            self.ln()
        self.ln(5)

def generate_forensic_pdf(title: str, content: str, output_path: str, case_id: str | None = None, progress_callback: callable = None):
    """
    Main entrypoint for generating a PDF report.
    Enriches with case metadata if available in DB.
    `progress_callback` should accept a string status message.
    """
    import os
    from supabase import create_client
    
    if progress_callback: progress_callback("Initializing forensic report architect...")
    
    case_meta = None
    if case_id:
        try:
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            if url and key:
                sb = create_client(url, key)
                res = sb.table("cases").select("*").eq("id", case_id).maybe_single().execute()
                if res.data:
                    case_meta = res.data
        except Exception as e:
            pass
    
    if progress_callback: progress_callback("Styling forensic certificate...")
    pdf = KuratorReport(case_metadata=case_meta)
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    
    # Render Certificate Page first!
    pdf.render_certificate_page()
    
    if progress_callback: progress_callback("Drafting report body from LLM intelligence...")
    pdf.add_page()
    
    # Reset text color for body
    pdf.set_text_color(0, 0, 0)
    
    # Title Section
    pdf.set_font('helvetica', 'B', 20)
    pdf.multi_cell(0, 15, pdf._clean_text(title.upper()), align='L')
    pdf.set_font('helvetica', 'I', 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 10, pdf._clean_text(f'Formal Report - Case ID: {case_id or "N/A"}'), ln=True)
    pdf.ln(10)
    
    # Body Styling
    pdf.set_text_color(0, 0, 0)
    effective_page_width = pdf.w - 2 * pdf.l_margin
    
    # Pre-process content for citations [Doc: Name, Pg: X]
    # We convert them to superscript-style footnotes
    
    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = str(lines[i]).strip()
        if not line:
            pdf.ln(4)
            i += 1
            continue
        
        # Handle Tables (| col | col |)
        if line.startswith('|') and i + 1 < len(lines) and lines[i+1].strip().startswith('|---'):
            header = [cell.strip() for cell in line.split('|') if cell.strip()]
            i += 2 
            data = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                row = [cell.strip() for cell in lines[i].split('|') if cell.strip()]
                if row: data.append(row)
                i += 1
            pdf.render_table(header, data)
            continue

        # Handle Headers
        if line.startswith('# '):
            pdf.set_font('helvetica', 'B', 16)
            pdf.set_text_color(41, 121, 255)
            pdf.multi_cell(effective_page_width, 10, pdf._clean_text(line[2:]))
            pdf.ln(2)
        elif line.startswith('## '):
            pdf.set_font('helvetica', 'B', 14)
            pdf.set_text_color(30, 30, 30)
            pdf.multi_cell(effective_page_width, 10, pdf._clean_text(line[3:]))
            pdf.ln(1)
        elif line.startswith('### '):
            pdf.set_font('helvetica', 'B', 11)
            pdf.set_text_color(60, 60, 60)
            pdf.multi_cell(effective_page_width, 7, pdf._clean_text(line[4:]))
        
        # Handle Lists
        elif line.startswith('- ') or line.startswith('* '):
            pdf.set_font('helvetica', '', 10)
            pdf.set_text_color(0, 0, 0)
            # Check for citations in list items
            item_text = line[2:]
            # Simple citation extractor: [Doc: ..., Pg: ...]
            citations = re.findall(r"\[Doc:.*?, Pg:.*?\]", item_text)
            for cite in citations:
                note_num = pdf.add_footnote(cite[1:-1])
                item_text = item_text.replace(cite, f" ({note_num})")
            
            pdf.multi_cell(effective_page_width, 6, pdf._clean_text(f"  • {item_text}"))
        
        # Standard Paragraph
        else:
            pdf.set_font('helvetica', '', 10)
            pdf.set_text_color(0, 0, 0)
            # Check for citations in text
            para_text = line
            # Para text sanitization (Unicode mapping)
            para_text = pdf._clean_text(line)
            citations = re.findall(r"\[Doc:.*?, Pg:.*?\]", para_text)
            for cite in citations:
                note_num = pdf.add_footnote(cite[1:-1])
                para_text = para_text.replace(cite, f" ({note_num})")
            
            pdf.multi_cell(effective_page_width, 6, para_text)
            pdf.ln(1)
        
        i += 1
            
    # Render Footer Note page if citations present
    pdf.render_footnotes()
    
    if progress_callback: progress_callback("Finalizing forensic file encoding...")
    pdf.output(output_path)
    return output_path
