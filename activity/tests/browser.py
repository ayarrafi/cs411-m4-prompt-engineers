"""Run with Playwright Python and installed Chrome; override CHROME_PATH if needed."""
import json,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:8099';KEY='cs411-study-v1'
server=subprocess.Popen(['node','server.mjs'],cwd=HERE,env={**os.environ,'PORT':'8099'},stdout=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:urllib.request.urlopen(BASE);break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROME_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),headless=True)
  def state(page):return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEY)
  def consent(page,c):
   page.goto(BASE+'/?condition='+c+'&pid=P01');page.locator('[name=agree]').check();page.get_by_role('button',name='Consent and begin pre-test').click()
  def assessment(page,post=False):
   for key,v in {'q1':'A' if post else 'B','q2':'A','q3a':'A','q4':'True' if post else 'False'}.items():page.locator(f'[name={key}][value="{v}"]').check()
   page.locator('#q3b').fill('2.5' if post else '2.4');page.locator('#q3c').fill('  Closer because the distance decreases.\n ');page.locator('#q5').fill('  Gradient sets downhill direction.\nRepeat updates to minimize.  ')
   if not post:page.locator('[name=experience]').first.check()
   page.get_by_role('button',name='Finalize '+('post-test' if post else 'pre-test')+' responses').click()
  def slider(page,id,v):page.locator('#'+id).evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));}',str(v))
  def explain(page):
   page.locator('textarea[id^=exp-]').fill('  The gradient determines direction and learning rate scales the step.  ');page.get_by_role('button',name='Submit explanation',exact=True).click()
  for condition in ['control','ai']:
   ctx=browser.new_context(reduced_motion='reduce');page=ctx.new_page();errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   def mock(route):
    requests.append(route.request.post_data_json);route.fulfill(status=200,content_type='application/json',body=json.dumps({'text':'Compare the first two rows of the table.'}))
   page.route('**/api/tutor',mock);consent(page,condition);assert not page.locator('#lesson').is_visible()
   page.locator('#q5').fill(' draft\n preserved ');page.reload();assert page.locator('#q5').input_value()==' draft\n preserved '
   assessment(page);page.locator('#runBtn').wait_for();assert not page.locator('#condAI').count()
   for rate in [.1,.5,.9]:slider(page,'lr',rate);page.locator('#runBtn').click()
   if condition=='ai':page.get_by_role('button',name="I'm stuck",exact=True).click();page.locator('.msg.t').filter(has_text='Compare the first two rows of the table.').wait_for()
   else:page.get_by_text('Predefined hint 1',exact=True).click()
   page.reload();page.locator('#runBtn').wait_for();assert len(state(page)['lesson']['state']['runs']['explore'])==3
   page.get_by_role('button',name='Continue to the theory').click()
   for _ in range(2):page.get_by_role('button',name='Next step',exact=True).click()
   page.get_by_role('button',name='Check my understanding').click()
   if condition=='control':assert not page.get_by_text('Predefined hint 3',exact=True).count()
   page.locator('#num-t1').fill('9');page.locator('#runBtn').click()
   if condition=='control':assert page.get_by_text('Predefined hint 3',exact=True).count()==1
   page.get_by_role('button',name='Try again').click()
   page.locator('#num-t1').fill('4.2');page.locator('#runBtn').click();explain(page);page.get_by_role('button',name='Continue',exact=True).click()
   page.locator('[name=pred-t2][value=oscillate]').check();page.locator('#runBtn').click();explain(page);page.get_by_role('button',name='Continue',exact=True).click()
   for mission,rate,x in [('m1',.5,None),('m2',.12,None),('m3',.2,-1),('m4',1,1)]:
    slider(page,'lr',rate)
    if x is not None:slider(page,'x0',x)
    page.locator(f'[name=pred-{mission}][value=global]').check();page.locator('#runBtn').click();explain(page);page.get_by_role('button',name='Go to the transfer check' if mission=='m4' else 'Next mission',exact=True).click()
   page.locator('#as-a1').fill('4');page.locator('[name=as-a2][value=diverge]').check();page.locator('[name=as-a3][value=oscillate]').check();page.locator('#as-why').fill('The distance shrinks while alternating sides.');page.get_by_role('button',name='Submit answers',exact=True).click();page.get_by_role('button',name='See lesson summary').click()
   page.get_by_role('button',name='Begin post-test').wait_for();assert not page.locator('#lesson').is_visible();page.get_by_role('button',name='Begin post-test').click();before=len(requests);assessment(page,True);assert len(requests)==before
   for name in ['helped','difficult','decision']:page.locator('#'+name).fill('  A specific example\nwith whitespace.  ')
   page.locator('[name=assistance][value=No]').check();page.get_by_role('button',name='Finalize feedback and finish').click();page.get_by_text('Thank you — your responses are finalized',exact=True).wait_for()
   for kind in ['participant','summary','events']:
    with page.expect_download() as dl:page.locator('[data-export='+kind+']').click()
    contents=Path(dl.value.path()).read_text();assert contents
    if kind=='participant':
     data=json.loads(contents);assert data['tests']['pre']['score']['objectiveTotal']==4;assert data['tests']['pre']['score']['total'] is None;assert data['gains']['raw'] is None
     assert data['tests']['post']['answers']['q5'].startswith('  ');assert data['lesson']['state']['results']['t1']['explanation'].endswith('  ');assert data['learningStatus']=='completed';assert not data['incompleteSteps']
   assert (len(requests)>0)==(condition=='ai');assert not errors,errors
   page.goto(BASE+'/?condition='+('ai' if condition=='control' else 'control'));page.get_by_text('Thank you — your responses are finalized',exact=True).wait_for();assert state(page)['condition']==condition
   print('PASS full flow, recovery, scoring, exports, isolation:',condition);ctx.close()
  ctx=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=ctx.new_page();page.on('dialog',lambda d:d.accept());consent(page,'ai');assessment(page)
  page.get_by_role('button',name="I'm stuck",exact=True).click();page.get_by_role('button',name='Retry AI assistance').wait_for();assert 'No predefined hint has been substituted' in page.locator('#panel').inner_text()
  page.locator('#runBtn').click();page.wait_for_timeout(1100);assert state(page)['reviewRequired'];assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.keyboard.press('Tab');assert page.evaluate('document.activeElement!==document.body')
  other=ctx.new_page();other.goto(BASE+'/?condition=ai');other.get_by_text('This study is active in another tab.',exact=False).wait_for();other.close()
  page.add_init_script("let d=JSON.parse(localStorage.getItem('cs411-study-v1'));if(d?.phase==='learning'){d.timing.learning.startedAt=Date.now()-1801000;localStorage.setItem('cs411-study-v1',JSON.stringify(d));}")
  page.reload();page.get_by_role('button',name='Begin post-test').wait_for();assert state(page)['learningStatus']=='time_limit_incomplete';assert len(state(page)['lesson']['state']['runs']['explore'])==1
  with page.expect_download():page.locator('[data-export=participant]').click()
  print('PASS unavailable AI, mobile, keyboard, duplicate tab, timer expiry, expiry export');ctx.close();browser.close()
finally:server.terminate();server.wait()
