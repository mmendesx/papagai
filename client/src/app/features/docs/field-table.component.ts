import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FieldDef } from './api-endpoints';

/**
 * Renders a semantic field-documentation table for a BodyExampleDef.fields array
 * or a WEBHOOK_PAYLOAD_EXAMPLES.fields array.
 *
 * Placed as a SIBLING of the JSON code block — never inside it — so copy-JSON
 * buttons only capture the JSON string, not table text.
 *
 * On narrow screens the table container scrolls horizontally (overflow-x:auto)
 * to preserve semantic th[scope=col] markup for screen readers.
 */
@Component({
  selector: 'app-field-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field-table-scroll" role="region" aria-label="Campos do payload">
      <table class="field-table">
        <thead>
          <tr>
            <th scope="col">Campo</th>
            <th scope="col">Tipo</th>
            <th scope="col">Req.</th>
            <th scope="col">Descrição</th>
          </tr>
        </thead>
        <tbody>
          @for (f of fields(); track f.field) {
            <tr>
              <td><code class="field-name">{{ f.field }}</code></td>
              <td><code class="field-type">{{ f.type }}</code></td>
              <td>
                @if (f.required) {
                  <span class="req-badge" aria-label="obrigatório">req</span>
                } @else {
                  <span class="opt-label" aria-label="opcional">—</span>
                }
              </td>
              <td class="field-desc">{{ f.description }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
      :host { display: block; }

      .field-table-scroll {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border: 1px solid var(--color-outline-variant);
        border-radius: var(--radius-lg);
      }

      .field-table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--font-sans);
        font-size: 0.8125rem;
        line-height: 1.5;
        /* Ensure table can shrink with the scroll container */
        min-width: 28rem;
      }

      .field-table thead tr {
        background: var(--color-surface-container-low);
        border-bottom: 1px solid var(--color-outline-variant);
      }

      .field-table th {
        text-align: left;
        padding: 0.5rem 0.75rem;
        font-family: var(--font-display);
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-on-surface-variant);
        white-space: nowrap;
      }

      .field-table tbody tr {
        border-bottom: 1px solid var(--color-outline-variant);
      }

      .field-table tbody tr:last-child {
        border-bottom: none;
      }

      .field-table tbody tr:nth-child(even) {
        background: color-mix(in srgb, var(--color-surface-container-low) 50%, transparent);
      }

      .field-table td {
        padding: 0.5rem 0.75rem;
        vertical-align: top;
        color: var(--color-on-surface-variant);
      }

      .field-name {
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.75rem;
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 8%, transparent);
        padding: 0.1rem 0.375rem;
        border-radius: var(--radius-sm);
        white-space: nowrap;
      }

      .field-type {
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.6875rem;
        color: var(--color-on-surface-variant);
        white-space: nowrap;
      }

      .req-badge {
        display: inline-block;
        font-size: 0.5625rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-error);
        background: var(--color-error-bg);
        padding: 0.125rem 0.375rem;
        border-radius: var(--radius-full);
        white-space: nowrap;
      }

      .opt-label {
        color: var(--color-on-surface-variant);
        opacity: 0.5;
        font-size: 0.8125rem;
      }

      .field-desc {
        color: var(--color-on-surface-variant);
        line-height: 1.55;
      }
    `,
  ],
})
export class FieldTableComponent {
  readonly fields = input.required<FieldDef[]>();
}
