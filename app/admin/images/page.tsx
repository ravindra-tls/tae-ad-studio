import { ImagesGallerySection } from './images-gallery-section';

export default function AdminImagesPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between stagger-item" style={{ animationDelay: '40ms' }}>
        <div>
          <h1 className="text-2xl font-bold text-brand-forest">Generated Images</h1>
          <p className="mt-1 text-sm text-brand-slate">All generated images across the workspace.</p>
        </div>
      </div>
      <div className="stagger-item" style={{ animationDelay: '100ms' }}>
        <ImagesGallerySection />
      </div>
    </div>
  );
}
