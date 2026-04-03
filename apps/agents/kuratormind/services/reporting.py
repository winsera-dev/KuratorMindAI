from fpdf import FPDF  # type: ignore
from datetime import datetime
from typing import cast

class KuratorReport(FPDF):
    def header(self):
        # Logo placeholder (commented out for now)
        # self.image('logo.png', 10, 8, 33)
        self.set_font('helvetica', 'B', 12)
        self.cell(0, 10, 'KuratorMind AI - Forensic Intelligence Report', border=False, align='R')
        self.ln(15)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}} - Generated on {datetime.now().strftime("%Y-%m-%d %H:%M")}', align='C')

def generate_forensic_pdf(title: str, content: str, output_path: str):
    """Generates a professional PDF from Markdown-style content.
    
    Args:
        title: The report title.
        content: The markdown content (simplified support).
        output_path: Where to save the PDF.
    """
    pdf = KuratorReport()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Title
    pdf.set_font('helvetica', 'B', 16)
    pdf.multi_cell(0, 10, title, align='L')
    pdf.ln(5)
    
    # Body
    pdf.set_font('helvetica', '', 11)
    effective_page_width = pdf.w - 2 * pdf.l_margin
    
    # Basic Markdown processing
    for line_raw in content.split('\n'):
        line = str(line_raw).strip()
        if not line:
            pdf.ln(4)
            continue
        
        if line.startswith('# '):
            pdf.set_font('helvetica', 'B', 14)
            pdf.multi_cell(effective_page_width, 10, line[2:])  # type: ignore
            pdf.ln(2)
            pdf.set_font('helvetica', '', 11)
        elif line.startswith('## '):
            pdf.set_font('helvetica', 'B', 12)
            pdf.multi_cell(effective_page_width, 8, line[3:])  # type: ignore
            pdf.ln(1)
            pdf.set_font('helvetica', '', 11)
        elif line.startswith('### '):
            pdf.set_font('helvetica', 'B', 11)
            pdf.multi_cell(effective_page_width, 7, line[4:])  # type: ignore
            pdf.set_font('helvetica', '', 11)
        elif line.startswith('- ') or line.startswith('* '):
            pdf.multi_cell(effective_page_width, 6, f"  - {line[2:]}")  # type: ignore
        else:
            pdf.multi_cell(effective_page_width, 6, line)
            pdf.ln(1)
            
    pdf.output(output_path)
    return output_path
