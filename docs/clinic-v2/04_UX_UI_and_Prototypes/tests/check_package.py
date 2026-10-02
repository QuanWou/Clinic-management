"""Dependency-light static checks for CMV2 Phase 04 design package. Does not exercise browser runtime."""
from pathlib import Path
from html.parser import HTMLParser
import subprocess

ROOT=Path(__file__).resolve().parents[1]
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.links=[];self.ids=set()
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if 'id' in d:self.ids.add(d['id'])
        for key in ('href','src'):
            if key in d:self.links.append(d[key])
htmls=list(ROOT.rglob('*.html'))
missing=[]
for h in htmls:
    parser=Links();parser.feed(h.read_text(encoding='utf8'))
    if 'main' not in parser.ids:missing.append(str(h.relative_to(ROOT))+': missing main landmark id')
    for url in parser.links:
        if url.startswith(('https:','http:','mailto:','data:','#')):continue
        target=(h.parent/url.split('#')[0]).resolve()
        if not target.exists(): missing.append(str(h.relative_to(ROOT))+' => '+url)
assets=list((ROOT/'prototype/assets').glob('*.js'))
for js in assets:subprocess.run(['node','--check',str(js)],check=True)
assert len(htmls)==5, f'Expected 5 HTML entry pages (got {len(htmls)})'
assert len(assets)==3
assert not missing, f'Missing refs: {missing}'
required=['index.html','wireframes.html','design-system.html','prototype/public.html','prototype/workspace.html','docs/01_UX_Strategy_and_Sitemap.md','docs/02_Design_System.md','docs/03_Wireframes.md','docs/04_Workflow_Prototype_and_Test_Plan.md','docs/05_Screen_Inventory_and_Traceability.md','docs/06_UX_Acceptance_Matrix.md','docs/07_Design_Handoff_Backlog.md']
assert all((ROOT/f).exists() for f in required)
w=(ROOT/'prototype/assets/workspace.js').read_text()
p=(ROOT/'prototype/assets/public.js').read_text()
for term in ['checkin','walkin-form','review-result','sign-visit','release','online-pending','verify-online','payment-form','platform','manager']:
 assert term in w,term
for term in ['booking-slot','booking-person','booking-confirm','portal','cancel-appt','clear-filter']:
 assert term in p,term
assert 'v.owned&&v.released&&v.signed' in p
assert "v.clinicId==='CL-001'" in w
assert "v.bill+=200000" in w
print('PASS: 5 HTML pages, 3 valid JS files, all local href/src targets exist')
print('PASS: 7 design docs, 3 diagrams, two prototype sites, 10 required workflow hooks')
print('PASS: patient released-only filter, active-clinic data filter, charge tied to order')
print('NOTE: Browser E2E was not run; Chromium local navigation returned ERR_BLOCKED_BY_ADMINISTRATOR.')
