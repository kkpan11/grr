import {Clipboard} from '@angular/cdk/clipboard';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {Component} from '@angular/core';
import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {MatMenuHarness} from '@angular/material/menu/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {RouterModule} from '@angular/router';
import {MultiGetFileDetails} from '../../components/flow_details/plugins/multi_get_file_details';
import {getExportedResultsCsvUrl} from '../../lib/api/http_api_service';

import {
  FLOW_LIST_ITEMS_BY_TYPE,
  Flow,
  FlowDescriptor,
  FlowState,
  FlowType,
} from '../../lib/models/flow';
import {newFlow} from '../../lib/models/model_test_util';
import {STORE_PROVIDERS} from '../../store/store_test_providers';
import {
  DISABLED_TIMESTAMP_REFRESH_TIMER_PROVIDER,
  initTestEnvironment,
} from '../../testing';
import {FlowDetails} from './flow_details';
import {FlowDetailsModule} from './module';
import {FLOW_DETAILS_PLUGIN_REGISTRY} from './plugin_registry';
import {Plugin} from './plugins/plugin';

initTestEnvironment();

// TestHostComponent is needed in order to trigger change detection in the
// underlying flow-details directive. Creating a standalone flow-details
// instance with createComponent doesn't trigger the ngOnChanges lifecycle
// hook:
// https://stackoverflow.com/questions/37408801/testing-ngonchanges-lifecycle-hook-in-angular-2
@Component({
  standalone: false,
  template: `
<flow-details
    [flow]="flow"
    [flowDescriptor]="flowDescriptor"
    [showContextMenu]="showContextMenu">
</flow-details>`,
  jit: true,
})
class TestHostComponent {
  flow: Flow | undefined;
  flowDescriptor: FlowDescriptor | undefined;
  showContextMenu: boolean | undefined;
  webAuthType: string | undefined;
  exportCommandPrefix: string | undefined;
}

describe('FlowDetails Component', () => {
  let clipboard: Partial<Clipboard>;

  beforeEach(waitForAsync(() => {
    clipboard = {
      copy: jasmine.createSpy('copy').and.returnValue(true),
    };

    TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        FlowDetailsModule,
        RouterModule.forRoot([]),
      ],
      declarations: [TestHostComponent],
      providers: [
        ...STORE_PROVIDERS,
        DISABLED_TIMESTAMP_REFRESH_TIMER_PROVIDER,
        {
          provide: Clipboard,
          useFactory: () => clipboard,
        },
      ],
      teardown: {destroyAfterEach: false},
    }).compileComponents();

    clipboard = {
      copy: jasmine.createSpy('copy').and.returnValue(true),
    };
  }));

  function createComponent(
    flow: Flow,
    flowDescriptor?: FlowDescriptor,
    showContextMenu?: boolean,
    webAuthType?: string,
    exportCommandPrefix?: string,
  ): ComponentFixture<TestHostComponent> {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.flow = flow;
    fixture.componentInstance.flowDescriptor = flowDescriptor;
    fixture.componentInstance.showContextMenu = showContextMenu;
    fixture.componentInstance.webAuthType = webAuthType;
    fixture.componentInstance.exportCommandPrefix = exportCommandPrefix;
    fixture.detectChanges();

    return fixture;
  }

  const sampleFlowName = 'SampleFlow' as FlowType;

  const SAMPLE_FLOW_LIST_ENTRY = Object.freeze(
    newFlow({
      flowId: '42',
      clientId: 'C.123',
      lastActiveAt: new Date('2019-09-23T12:00:00+0000'),
      startedAt: new Date('2019-08-23T12:00:00+0000'),
      name: sampleFlowName,
      creator: 'testuser',
      resultCounts: [],
    }),
  );

  const SAMPLE_FLOW_DESCRIPTOR = Object.freeze({
    name: sampleFlowName,
    friendlyName: 'Sample Flow',
    category: 'Some category',
    blockHuntCreation: false,
    defaultArgs: {},
  });

  it('displays flow item name when a flow item exists for a given flow', () => {
    const SAMPLE_FLOW_LIST_ITEM = {
      type: sampleFlowName,
      friendlyName: 'Sample Flow List Item',
      description: '',
      enabled: true,
    };

    FLOW_LIST_ITEMS_BY_TYPE[sampleFlowName] = SAMPLE_FLOW_LIST_ITEM;

    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
    );

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain(SAMPLE_FLOW_LIST_ITEM.friendlyName);

    delete FLOW_LIST_ITEMS_BY_TYPE[sampleFlowName];
  });

  it('displays flow descriptor friendly name when a flow item does not contain a friendly name', () => {
    const SAMPLE_FLOW_LIST_ITEM = {
      type: sampleFlowName,
      friendlyName: '',
      description: '',
      enabled: true,
    };

    FLOW_LIST_ITEMS_BY_TYPE[sampleFlowName] = SAMPLE_FLOW_LIST_ITEM;

    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
    );

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain(SAMPLE_FLOW_DESCRIPTOR.friendlyName);

    delete FLOW_LIST_ITEMS_BY_TYPE[sampleFlowName];
  });

  it('displays flow descriptor friendly name when a flow item does not exist for a given flow', () => {
    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
    );

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain(SAMPLE_FLOW_DESCRIPTOR.friendlyName);
  });

  it('displays flow name when flow descriptor is not set', () => {
    const fixture = createComponent(SAMPLE_FLOW_LIST_ENTRY);

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain(sampleFlowName);
    expect(text).toContain('2019');
    expect(text).toContain('testuser');
  });

  it('displays flow friendly name if flow descriptor is set', () => {
    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
    );

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).not.toContain(sampleFlowName);
    expect(text).toContain('Sample Flow');
  });

  it('displays new flow on "flow" binding update', () => {
    const fixture = createComponent(SAMPLE_FLOW_LIST_ENTRY);

    fixture.componentInstance.flow = newFlow({
      ...SAMPLE_FLOW_LIST_ENTRY,
      name: 'AnotherFlow',
    });
    fixture.detectChanges();

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).not.toContain(sampleFlowName);
    expect(text).toContain('AnotherFlow');
  });

  it('uses dedicated plugin if available', () => {
    FLOW_DETAILS_PLUGIN_REGISTRY[sampleFlowName] = MultiGetFileDetails;

    const fixture = createComponent(SAMPLE_FLOW_LIST_ENTRY);
    expect(
      fixture.debugElement.query(By.directive(MultiGetFileDetails)),
    ).not.toBeNull();
  });

  it('does NOT display flow arguments if flow descriptor is not set', () => {
    const fixture = createComponent(SAMPLE_FLOW_LIST_ENTRY);

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).not.toContain('Flow arguments');
  });

  it('displays flow arguments if flow descriptor is set', () => {
    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
    );

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain('Flow arguments');
  });

  it('does NOT display download button when flow is NOT finished', () => {
    const fixture = createComponent({
      ...SAMPLE_FLOW_LIST_ENTRY,
      state: FlowState.RUNNING,
    });

    fixture.detectChanges();

    expect(fixture.nativeElement.innerText).not.toContain('Download');
  });

  it('does NOT display download button when flow is has no results', () => {
    const fixture = createComponent({
      ...SAMPLE_FLOW_LIST_ENTRY,
      state: FlowState.FINISHED,
      resultCounts: [],
    });

    fixture.detectChanges();

    expect(fixture.nativeElement.innerText).not.toContain('Download');
  });

  it('displays download button when flow has results', () => {
    const fixture = createComponent({
      ...SAMPLE_FLOW_LIST_ENTRY,
      flowId: '456',
      clientId: 'C.123',
      state: FlowState.FINISHED,
      resultCounts: [{type: 'Foo', count: 1}],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.innerText).toContain('Download');
    expect(
      fixture.debugElement.query(By.css('.export-button')).nativeElement
        .attributes.href?.value,
    ).toEqual(getExportedResultsCsvUrl('C.123', '456'));
  });

  it('displays download options in menu when flow has results', async () => {
    const fixture = createComponent({
      ...SAMPLE_FLOW_LIST_ENTRY,
      flowId: '456',
      clientId: 'C.123',
      state: FlowState.FINISHED,
      resultCounts: [{type: 'Foo', count: 1}],
    });
    fixture.detectChanges();

    const detailsComponent: Plugin = fixture.debugElement.query(
      By.directive(FlowDetails),
    ).componentInstance.detailsComponent.instance;
    const declaredMenuItems = detailsComponent.getExportMenuItems(
      detailsComponent.flow,
      '' /** exportCommandPrefix can be left empty for testing purposes */,
    );

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    const renderedMenuItems = await menu.getItems();

    // SAMPLE_FLOW_LIST_ENTRY renders DefaultDetails as fallback, which contains
    // the default download options from Plugin.
    expect(renderedMenuItems.length).toEqual(declaredMenuItems.length - 1);
    for (let i = 0; i < renderedMenuItems.length; i++) {
      expect(await renderedMenuItems[i].getText()).toEqual(
        declaredMenuItems[i + 1].title,
      );
    }
  });

  it('plugin creates copy export command options in menu when flow has results and prefix', async () => {
    const fixture = createComponent(
      {
        ...SAMPLE_FLOW_LIST_ENTRY,
        flowId: '456',
        clientId: 'C.123',
        state: FlowState.FINISHED,
        resultCounts: [{type: 'Foo', count: 1}],
      },
      SAMPLE_FLOW_DESCRIPTOR,
      true,
      'test-web-auth-type',
      'test-export-command-prefix',
    );
    fixture.detectChanges();

    const detailsComponent: Plugin = fixture.debugElement.query(
      By.directive(FlowDetails),
    ).componentInstance.detailsComponent.instance;
    const pluginMenuItems = detailsComponent.getExportMenuItems(
      detailsComponent.flow,
      'test-export-command-prefix',
    );

    expect(await pluginMenuItems[pluginMenuItems.length - 1].title).toEqual(
      'Download (Print CLI)',
    );
  });

  it('displays "0 results" if flow has no results', () => {
    const fixture = createComponent({
      ...SAMPLE_FLOW_LIST_ENTRY,
      flowId: '456',
      clientId: 'C.123',
      state: FlowState.FINISHED,
      resultCounts: [],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.innerText).toContain('0 results');
  });

  it('hides "0 results" if flow is still running', () => {
    const fixture = createComponent({
      ...SAMPLE_FLOW_LIST_ENTRY,
      flowId: '456',
      clientId: 'C.123',
      state: FlowState.RUNNING,
      resultCounts: [],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.innerText).not.toContain('0 results');
  });

  it('displays total result count', () => {
    const fixture = createComponent({
      ...SAMPLE_FLOW_LIST_ENTRY,
      flowId: '456',
      clientId: 'C.123',
      state: FlowState.FINISHED,
      resultCounts: [
        {type: 'Foo', count: 1},
        {type: 'Bar', count: 3},
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.innerText).toContain('4 results');
  });

  afterEach(() => {
    delete FLOW_DETAILS_PLUGIN_REGISTRY[sampleFlowName];
  });

  it('displays flow context menu button', () => {
    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
      true,
    );
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.menu-button'))).toBeTruthy();
  });

  it('displays create hunt in flow context menu', async () => {
    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
      true,
    );
    fixture.detectChanges();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const menu = await loader.getHarness(
      MatMenuHarness.with({selector: '.menu-button'}),
    );
    await menu.open();
    const createHuntButton = fixture.debugElement.query(
      By.css('[name="createHunt"]'),
    );
    expect(createHuntButton).toBeTruthy();
    expect(createHuntButton.nativeElement.disabled).toBeFalsy();
  });

  it('disables create hunt in flow context menu if flow cannot run as hunt', async () => {
    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      {
        name: sampleFlowName,
        friendlyName: 'Sample Flow',
        category: 'Some category',
        blockHuntCreation: true,
        defaultArgs: {},
      },
      true,
    );
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.menu-button'))).toBeTruthy();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const menu = await loader.getHarness(
      MatMenuHarness.with({selector: '.menu-button'}),
    );
    await menu.open();
    const createHuntButton = fixture.debugElement.query(
      By.css('[name="createHunt"]'),
    );
    expect(createHuntButton).toBeTruthy();
    expect(createHuntButton.nativeElement.disabled).toBeTruthy();
  });

  it('hides flow context menu button', () => {
    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
      false,
    );
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.menu-button'))).toBeFalsy();
  });

  it('emits the right copy link', () => {
    const fixture = createComponent(
      {...SAMPLE_FLOW_LIST_ENTRY, flowId: '456', clientId: 'C.123'},
      SAMPLE_FLOW_DESCRIPTOR,
      false,
    );
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('app-copy-button.flow-link')),
    ).toBeTruthy();

    fixture.debugElement
      .query(By.css('app-copy-button.flow-link'))
      .triggerEventHandler('click', new MouseEvent('click'));

    expect(clipboard.copy).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(new RegExp('^http.*/clients/C.123/flows/456')),
    );
  });

  it('displays "Copy API Create Request" button', async () => {
    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
      true,
      'test-web-auth-type',
    );
    fixture.detectChanges();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const menu = await loader.getHarness(
      MatMenuHarness.with({selector: '.menu-button'}),
    );
    await menu.open();
    const copyApiCreateRequestButton = fixture.debugElement.query(
      By.css('[name="copyApiCreateRequest"]'),
    );
    expect(copyApiCreateRequestButton).toBeTruthy();
    expect(copyApiCreateRequestButton.nativeElement.disabled).toBe(false);
  });

  it('emits the right copy API create request', async () => {
    const expectedStr = `CSRFTOKEN='curl .* -o /dev/null -s -c - | grep csrftoken  | cut -f 7' \\
    curl -X POST -H "Content-Type: application/json" -H "X-CSRFToken: $CSRFTOKEN" \\
    .* -d @- << EOF
  {
    "flow": {
      "name": "SampleFlow"
    }
  }
  EOF`;
    const fixture = createComponent(
      SAMPLE_FLOW_LIST_ENTRY,
      SAMPLE_FLOW_DESCRIPTOR,
      true,
      'test-web-auth-type',
    );
    fixture.detectChanges();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const menu = await loader.getHarness(
      MatMenuHarness.with({selector: '.menu-button'}),
    );
    await menu.open();

    fixture.debugElement
      .query(By.css('[name="copyApiCreateRequest"]'))
      .triggerEventHandler('click', new MouseEvent('click'));

    expect(clipboard.copy).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(new RegExp(expectedStr)),
    );
  });
});
