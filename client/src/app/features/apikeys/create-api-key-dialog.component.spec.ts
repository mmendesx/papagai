import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TuiAlertService } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { EMPTY } from 'rxjs';
import { CreateApiKeyDialogComponent } from './create-api-key-dialog.component';

describe(CreateApiKeyDialogComponent.name, () => {
  let fixture: ComponentFixture<CreateApiKeyDialogComponent>;
  let http: HttpTestingController;

  const context = {
    data: { scope: 'account' as const },
    completeWith: jasmine.createSpy('completeWith'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateApiKeyDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: POLYMORPHEUS_CONTEXT, useValue: context },
        {
          provide: TuiAlertService,
          useValue: { open: jasmine.createSpy('open').and.returnValue(EMPTY) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateApiKeyDialogComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('projects the account template options through the Taiga textfield dropdown', async () => {
    fixture.detectChanges();
    flushInstances();
    flushTemplates();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Template de permissao');
    expect(text).toContain('Manage instances');
  });

  it('projects the instance options through the Taiga textfield dropdown', async () => {
    fixture.detectChanges();
    flushInstances();
    flushTemplates();
    await fixture.whenStable();

    fixture.componentInstance.scope.set('instance');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Instância');
    expect(fixture.componentInstance.instancesRes.value().instances[0].name).toBe('main');
  });

  it('keeps account key payloads using the selected permission template', async () => {
    fixture.detectChanges();
    flushInstances();
    flushTemplates();
    fixture.detectChanges();

    fixture.componentInstance.keyName.set('Ops key');
    fixture.componentInstance.selectedTemplateIdModel = 'readonly';
    fixture.componentInstance.expiresAt.set('2026-12-31');

    const submit = fixture.componentInstance.submit();

    const req = http.expectOne('/api/auth/apikeys');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Ops key',
      expiresAt: '2026-12-31',
      permissionsTemplate: 'readonly',
    });

    req.flush({
      id: 'key_1',
      name: 'Ops key',
      prefix: 'pap_',
      key: 'pap_secret',
      enabled: true,
      createdAt: '2026-05-13T00:00:00.000Z',
    });
    await submit;
  });

  it('keeps instance key payloads scoped to the selected instance', async () => {
    fixture.detectChanges();
    flushInstances();
    flushTemplates();
    await fixture.whenStable();

    fixture.componentInstance.scope.set('instance');
    fixture.componentInstance.keyName.set('Instance key');
    fixture.componentInstance.selectedInstanceModel = 'main';
    fixture.detectChanges();
    await fixture.whenStable();

    const submit = fixture.componentInstance.submit();

    const req = http.expectOne('/api/instances/main/apikeys');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Instance key' });

    req.flush({
      id: 'key_2',
      name: 'Instance key',
      prefix: 'pap_',
      key: 'pap_secret',
      enabled: true,
      createdAt: '2026-05-13T00:00:00.000Z',
    });
    await submit;
  });

  it('stores the selected instance as a displayable name instead of an object', async () => {
    fixture.detectChanges();
    flushInstances();
    flushTemplates();
    await fixture.whenStable();

    fixture.componentInstance.selectedInstanceModel = {
      name: 'main',
      connected: true,
      phoneNumber: null,
    };
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.selectedInstanceModel).toBe('main');
    expect(fixture.componentInstance.selectedInstance()?.name).toBe('main');
  });

  function flushInstances(): void {
    http.expectOne('/api/instances').flush({
      instances: [{ name: 'main', connected: true, phoneNumber: null }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  }

  function flushTemplates(): void {
    http.expectOne('/api/auth/apikeys/templates').flush({
      templates: [
        {
          id: 'instance_manager',
          name: 'Instance manager',
          description: 'Manage instances',
          permissions: ['instances:*'],
        },
        {
          id: 'readonly',
          name: 'Read only',
          description: 'Read API keys',
          permissions: ['apikeys:read'],
        },
      ],
    });
  }
});
