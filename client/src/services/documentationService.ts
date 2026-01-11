/**
 * Documentation Service
 * Implements Single Responsibility Principle by managing documentation operations
 * Follows Open/Closed Principle - extensible for new documentation types
 */

export interface DocumentationPage {
  id: string;
  title: string;
  description: string;
  category: string;
  path: string;
  order: number;
}

export interface DocumentationCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  pages: DocumentationPage[];
}

export interface DocumentationMetadata {
  version: string;
  lastUpdated: string;
  author: string;
  contributors?: string[];
}

/**
 * Documentation service - handles all documentation-related operations
 * Follows Dependency Inversion Principle by exposing interfaces
 */
export class DocumentationService {
  /**
   * Get all documentation categories
   * @returns Array of documentation categories
   */
  static getCategories(): DocumentationCategory[] {
    return [
      {
        id: 'getting-started',
        name: 'Getting Started',
        description: 'Introduction and setup guides',
        pages: [
          {
            id: 'overview',
            title: 'Project Overview',
            description: 'Introduction to IMSOP platform',
            category: 'getting-started',
            path: '/docs/overview',
            order: 1,
          },
          {
            id: 'installation',
            title: 'Installation',
            description: 'Setup and installation instructions',
            category: 'getting-started',
            path: '/docs/installation',
            order: 2,
          },
          {
            id: 'quick-start',
            title: 'Quick Start',
            description: 'Get up and running quickly',
            category: 'getting-started',
            path: '/docs/quick-start',
            order: 3,
          },
        ],
      },
      {
        id: 'architecture',
        name: 'Architecture',
        description: 'System design and architecture',
        pages: [
          {
            id: 'system-design',
            title: 'System Design',
            description: 'High-level system architecture',
            category: 'architecture',
            path: '/docs/architecture/system-design',
            order: 1,
          },
          {
            id: 'microservices',
            title: 'Microservices',
            description: 'Microservices architecture patterns',
            category: 'architecture',
            path: '/docs/architecture/microservices',
            order: 2,
          },
          {
            id: 'data-flow',
            title: 'Data Flow',
            description: 'Data flow and processing',
            category: 'architecture',
            path: '/docs/architecture/data-flow',
            order: 3,
          },
        ],
      },
      {
        id: 'api-reference',
        name: 'API Reference',
        description: 'Complete API documentation',
        pages: [
          {
            id: 'authentication',
            title: 'Authentication',
            description: 'API authentication and authorization',
            category: 'api-reference',
            path: '/docs/api/authentication',
            order: 1,
          },
          {
            id: 'endpoints',
            title: 'Endpoints',
            description: 'Available API endpoints',
            category: 'api-reference',
            path: '/docs/api/endpoints',
            order: 2,
          },
          {
            id: 'webhooks',
            title: 'Webhooks',
            description: 'Webhook integration guide',
            category: 'api-reference',
            path: '/docs/api/webhooks',
            order: 3,
          },
        ],
      },
      {
        id: 'deployment',
        name: 'Deployment',
        description: 'Deployment and operations',
        pages: [
          {
            id: 'kubernetes',
            title: 'Kubernetes Deployment',
            description: 'Deploy to Kubernetes',
            category: 'deployment',
            path: '/docs/deployment/kubernetes',
            order: 1,
          },
          {
            id: 'monitoring',
            title: 'Monitoring',
            description: 'Monitoring and observability',
            category: 'deployment',
            path: '/docs/deployment/monitoring',
            order: 2,
          },
          {
            id: 'scaling',
            title: 'Scaling',
            description: 'Scaling strategies',
            category: 'deployment',
            path: '/docs/deployment/scaling',
            order: 3,
          },
        ],
      },
    ];
  }

  /**
   * Get documentation page by ID
   * @param pageId - The page identifier
   * @returns Documentation page or null if not found
   */
  static getPageById(pageId: string): DocumentationPage | null {
    const categories = this.getCategories();
    for (const category of categories) {
      const page = category.pages.find((p) => p.id === pageId);
      if (page) {
        return page;
      }
    }
    return null;
  }

  /**
   * Get documentation pages by category
   * @param categoryId - The category identifier
   * @returns Array of pages in the specified category
   */
  static getPagesByCategory(categoryId: string): DocumentationPage[] {
    const category = this.getCategories().find((c) => c.id === categoryId);
    return category ? category.pages : [];
  }

  /**
   * Search documentation pages
   * @param keyword - The search keyword
   * @returns Array of matching pages
   */
  static searchPages(keyword: string): DocumentationPage[] {
    const lowerKeyword = keyword.toLowerCase();
    const allPages = this.getCategories().flatMap((c) => c.pages);
    
    return allPages.filter(
      (p) =>
        p.title.toLowerCase().includes(lowerKeyword) ||
        p.description.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Get documentation metadata
   * @returns Documentation metadata
   */
  static getMetadata(): DocumentationMetadata {
    return {
      version: '1.0.0',
      lastUpdated: '2026-01-09',
      author: 'Andrew Gotora',
      contributors: ['Andrew Gotora'],
    };
  }

  /**
   * Get navigation structure for sidebar
   * @returns Hierarchical navigation structure
   */
  static getNavigation(): Array<{ category: string; pages: DocumentationPage[] }> {
    return this.getCategories().map((cat) => ({
      category: cat.name,
      pages: cat.pages.sort((a, b) => a.order - b.order),
    }));
  }

  /**
   * Get breadcrumb trail for a page
   * @param pageId - The page identifier
   * @returns Array of breadcrumb items
   */
  static getBreadcrumbs(pageId: string): Array<{ label: string; path: string }> {
    const page = this.getPageById(pageId);
    if (!page) {
      return [];
    }

    const category = this.getCategories().find((c) => c.id === page.category);
    
    return [
      { label: 'Home', path: '/' },
      { label: 'Documentation', path: '/docs' },
      ...(category ? [{ label: category.name, path: `/docs/${category.id}` }] : []),
      { label: page.title, path: page.path },
    ];
  }
}
