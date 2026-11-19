/**
 * Screen Edge Damage Vignette Flash when receiving damage.
 */
export class DamageIndicator {
  private element: HTMLElement;
  private life = 0;
  private maxLife = 0.35;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'damage-indicator';
    this.element.style.position = 'absolute';
    this.element.style.top = '0';
    this.element.style.left = '0';
    this.element.style.width = '100%';
    this.element.style.height = '100%';
    this.element.style.pointerEvents = 'none';
    this.element.style.boxShadow = 'inset 0 0 80px rgba(255, 23, 68, 0.7)';
    this.element.style.opacity = '0';
    this.element.style.zIndex = '110';
    this.element.style.transition = 'opacity 0.05s ease';

    parent.appendChild(this.element);
  }

  public flash(): void {
    this.life = this.maxLife;
    this.element.style.opacity = '1';
  }

  public update(dt: number): void {
    if (this.life > 0) {
      this.life -= dt;
      this.element.style.opacity = Math.max(0, this.life / this.maxLife).toString();
    }
  }
}
