import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { HfInference } from '@huggingface/inference';
import { AlertCircle, Bold, Heading1, Italic, Link, List, LayoutDashboard, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Interface definitions
interface SEOCheckResult {
  score: number;
  suggestions: string[];
}

// Utility functions
function calculateKeywordDensity(text: string): SEOCheckResult {
  const words = text.toLowerCase().split(/\s+/);
  const wordFrequency: { [key: string]: number } = {};
  
  words.forEach(word => {
    if (word.length > 3) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });

  const suggestions: string[] = [];
  let score = 1;

  const keywords = Object.entries(wordFrequency)
    .filter(([_, count]) => count > 1)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 5);

  if (keywords.length === 0) {
    suggestions.push("No clear keywords found. Consider using relevant keywords multiple times.");
    score = 0.3;
  } else if (keywords.length < 3) {
    suggestions.push("Limited keyword usage. Try incorporating more relevant keywords.");
    score = 0.6;
  }

  return { score, suggestions };
}

function checkTitleLength(text: string): SEOCheckResult {
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const suggestions: string[] = [];
  let score = 1;

  if (!titleMatch) {
    suggestions.push("No main title (H1) found. Add a clear title at the beginning.");
    score = 0;
  } else {
    const titleLength = titleMatch[1].length;
    if (titleLength < 30) {
      suggestions.push("Title is too short. Aim for 50-60 characters for better SEO.");
      score = 0.5;
    } else if (titleLength > 60) {
      suggestions.push("Title is too long. Keep it under 60 characters for better visibility in search results.");
      score = 0.7;
    }
  }

  return { score, suggestions };
}

function checkMetaDescription(text: string): SEOCheckResult {
  const firstParagraph = text.split('\n\n')[0].replace(/^#.*\n/, '').trim();
  const suggestions: string[] = [];
  let score = 1;

  if (!firstParagraph) {
    suggestions.push("Add a clear introductory paragraph that summarizes your content.");
    score = 0;
  } else if (firstParagraph.length < 120) {
    suggestions.push("Introduction is too short. Aim for 150-160 characters for better search visibility.");
    score = 0.5;
  } else if (firstParagraph.length > 160) {
    suggestions.push("Introduction is too long. Keep it under 160 characters for optimal display in search results.");
    score = 0.7;
  }

  return { score, suggestions };
}

function checkHeadings(text: string): SEOCheckResult {
  const headings = text.match(/^#{1,6}\s+.+$/gm) || [];
  const suggestions: string[] = [];
  let score = 1;

  if (headings.length === 0) {
    suggestions.push("No headings found. Use headings to structure your content.");
    score = 0;
  } else {
    const h1Count = headings.filter(h => h.startsWith('# ')).length;
    const hasSubheadings = headings.some(h => h.startsWith('## '));

    if (h1Count === 0) {
      suggestions.push("Add a main heading (H1) to your content.");
      score = 0.3;
    } else if (h1Count > 1) {
      suggestions.push("Multiple H1 headings found. Use only one main heading.");
      score = 0.5;
    }

    if (!hasSubheadings) {
      suggestions.push("Add subheadings (H2, H3) to better structure your content.");
      score = score * 0.7;
    }
  }

  return { score, suggestions };
}

function checkLinks(text: string): SEOCheckResult {
  const links = text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
  const suggestions: string[] = [];
  let score = 1;

  if (links.length === 0) {
    suggestions.push("No links found. Add relevant internal or external links to enhance content value.");
    score = 0.5;
  } else {
    const hasEmptyAnchors = links.some(link => link.includes('[]'));
    if (hasEmptyAnchors) {
      suggestions.push("Some links have empty anchor text. Add descriptive text to all links.");
      score = 0.7;
    }
  }

  return { score, suggestions };
}

function checkImageAlt(text: string): SEOCheckResult {
  const images = text.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
  const suggestions: string[] = [];
  let score = 1;

  if (images.length > 0) {
    const missingAlt = images.some(img => img.match(/!\[\]\(/));
    if (missingAlt) {
      suggestions.push("Some images are missing alt text. Add descriptive alt text to all images.");
      score = 0.5;
    }
  }

  return { score, suggestions };
}

function checkContentLength(text: string): SEOCheckResult {
  const wordCount = text.split(/\s+/).length;
  const suggestions: string[] = [];
  let score = 1;

  if (wordCount < 300) {
    suggestions.push("Content is too short. Aim for at least 300 words for better SEO.");
    score = 0.3;
  } else if (wordCount < 600) {
    suggestions.push("Consider adding more content. Long-form content (1000+ words) typically ranks better.");
    score = 0.7;
  }

  return { score, suggestions };
}

function checkParagraphLength(text: string): SEOCheckResult {
  const paragraphs = text.split(/\n\n+/);
  const suggestions: string[] = [];
  let score = 1;

  const longParagraphs = paragraphs.filter(p => p.split(/\s+/).length > 150);
  if (longParagraphs.length > 0) {
    suggestions.push("Some paragraphs are too long. Break them into smaller chunks for better readability.");
    score = 0.7;
  }

  return { score, suggestions };
}

function countSyllables(text: string): number {
  const word = text.toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/e\b/g, '') // Remove trailing 'e'
    .replace(/[aeiou]{2,}/g, 'a') // Count consecutive vowels as one
    .match(/[aeiouy]/g);
  
  return word ? word.length : 0;
}


function calculateReadabilityScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  if (sentences.length === 0 || words.length === 0) return 100;

  // Calculate Flesch-Kincaid Grade Level
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0);
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;
  
  // Adjusted formula to better match Hemingway's scoring
  const grade = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
  
  // Convert grade level to score (higher grade = lower score)
  const score = Math.max(0, Math.min(100, 100 - (grade * 8)));
  return Math.round(score);
}

function analyzeReadability(text: string) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const hardSentences: string[] = [];
  const veryHardSentences: string[] = [];
  
  sentences.forEach(sentence => {
    const words = sentence.trim().split(/\s+/);
    const wordCount = words.length;
    const syllables = words.reduce((count, word) => count + countSyllables(word), 0);
    const avgSyllablesPerWord = syllables / wordCount;
    
    // Adjusted thresholds to match Hemingway more closely
    if (wordCount > 30 || avgSyllablesPerWord > 2.5) {
      veryHardSentences.push(sentence.trim());
    } else if (wordCount > 20 || avgSyllablesPerWord > 2.0) {
      hardSentences.push(sentence.trim());
    }
  });

   const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalSyllables = words.reduce((count, word) => count + countSyllables(word), 0);
  
  // Adjusted grade level calculation
  const grade = Math.round(
    0.39 * (words.length / sentences.length) +
    11.8 * (totalSyllables / words.length) - 
    15.59
  );

  return {
    score: calculateReadabilityScore(text),
    hardSentences,
    veryHardSentences,
    grade: Math.max(1, Math.min(12, grade))
  };
}

// Initialize Supabase client
let supabase = null;
let hf = null;

try {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (supabaseUrl && supabaseUrl !== 'your_supabase_url_here' && 
      supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key_here') {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  if (import.meta.env.VITE_HUGGINGFACE_API_KEY && 
      import.meta.env.VITE_HUGGINGFACE_API_KEY !== 'your_huggingface_api_key_here') {
    hf = new HfInference(import.meta.env.VITE_HUGGINGFACE_API_KEY);
  }
} catch (error) {
  console.error('Error initializing clients:', error);
}

// Main App Component
function App() {
  const [content, setContent] = useState('');
  const [seoScore, setSeoScore] = useState(0);
  const [readabilityScore, setReadabilityScore] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hardSentences, setHardSentences] = useState<string[]>([]);
  const [veryHardSentences, setVeryHardSentences] = useState<string[]>([]);
  const [grade, setGrade] = useState<number>(0);
  const [hardSentenceRanges, setHardSentenceRanges] = useState<Array<{ start: number; end: number; type: 'hard' | 'veryHard' }>>([]);

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const pastedData = clipboardData.getData('text/html') || clipboardData.getData('text');
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pastedData;
    
    // Process the content recursively to maintain formatting
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        let result = '';
        
        // Process children first
        const childContent = Array.from(node.childNodes)
          .map(child => processNode(child))
          .join('');
        
        // Apply formatting based on tag
        switch (tagName) {
          case 'p':
            result = childContent + '\n\n';
            break;
          case 'strong':
          case 'b':
            result = `<strong>${childContent}</strong>`;
            break;
          case 'em':
          case 'i':
            result = `<em>${childContent}</em>`;
            break;
          case 'h1':
            result = `<h1>${childContent}</h1>\n`;
            break;
          case 'h2':
            result = `<h2>${childContent}</h2>\n`;
            break;
          case 'h3':
            result = `<h3>${childContent}</h3>\n`;
            break;
          case 'ul':
            result = '\n' + childContent;
            break;
          case 'ol':
            result = '\n' + childContent;
            break;
          case 'li':
            result = `• ${childContent}\n`;
            break;
          case 'a':
            result = `<a href="${element.getAttribute('href')}">${childContent}</a>`;
            break;
          case 'br':
            result = '\n';
            break;
          default:
            result = childContent;
        }
        
        return result;
      }
      
      return '';
    };

    let processedContent = processNode(tempDiv);
    
    // Clean up extra newlines
    processedContent = processedContent
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Insert at cursor position
    const target = e.target as HTMLDivElement;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(processedContent);
      range.insertNode(textNode);
      range.collapse(false);
    }

    // Update state and analyze
    setContent(processedContent);
    analyzeSEO(processedContent);
  };

  if (!supabase || !hf) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-center mb-4">Configuration Required</h2>
          <p className="text-gray-600 text-center mb-4">
            Please click the "Connect to Supabase" button in the top right corner to set up your database connection.
          </p>
          <p className="text-gray-600 text-center mb-4">
            Also ensure you've added your HuggingFace API key to the .env file.
          </p>
          <div className="text-sm text-gray-500 mt-4">
            <p className="font-medium mb-2">Required Environment Variables:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
              <li>VITE_HUGGINGFACE_API_KEY</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <LayoutDashboard className="h-8 w-8 text-indigo-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">SEO Content Optimizer</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <section className="mt-12">
          <div className="rounded-3xl overflow-hidden border border-gray-300 shadow-md flex flex-col md:flex-row">
            {/* Editor Section */}
            <div className="max-h-[80vh] overflow-y-auto p-8 flex-grow relative">
              <div>
                <div className="mb-4">
                  {/* Formatting Toolbar */}
                  <div role="toolbar" aria-orientation="horizontal" dir="ltr" 
                       className="flex flex-row items-center space-x-2 mb-4 p-2 bg-gray-50 rounded-md">
                    {/* Toolbar buttons remain the same... */}
                  </div>

                  {/* Editor */}
                  <div
                    contentEditable
                    className="ProseMirror prose dark:prose-invert prose-slate prose-p:leading-6 prose-p:tracking-tight prose-blockquote:leading-6 prose-headings:font-serif font-editor whitespace-pre-wrap relative overflow-auto outline-none w-full min-w-[10px] min-h-[300px] p-4 rounded-md border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    onPaste={handlePaste}
                    onInput={(e) => {
                      const content = e.currentTarget.innerHTML;
                      setContent(content);
                      analyzeSEO(content);
                    }}
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                </div>
              </div>
            </div>

            {/* Analysis Section */}
            <div className="bg-[#F7F7F3] p-6 mt-24 md:mt-0 w-full md:w-80">
              <div className="space-y-4">
                <div className="flex flex-col mb-8">
                  <h3 className="text-lg text-gray-700 font-semibold mb-4">Readability checker</h3>
                  
                  <div className="flex flex-col space-y-2">
                    <div className="flex flex-row space-x-2">
                      <h2 className={`text-base sm:text-lg ${grade <= 6 ? 'text-green-800' : grade <= 9 ? 'text-yellow-800' : 'text-red-800'}`}>
                        Grade {grade}
                      </h2>
                      <button className="flex-row items-center focus:outline-none text-sm p-0 inline-flex underline hover:brightness-110 cursor-pointer text-gray-600">
                        <AlertCircle className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-gray-500 font-light">
                      <strong>
                        {readabilityScore >= 80 ? 'Good.' : readabilityScore >= 60 ? 'Fair.' : 'Needs improvement.'}
                      </strong>
                    </p>
                  </div>

                  <div className="space-y-1 mt-4">
                    {veryHardSentences.length > 0 && (
                      <div className="group rounded p-2 bg-red-200">
                        <div className="flex flex-row space-x-1 text-sm text-red-900">
                          <p className="flex-1">
                            <span className="font-bold rounded-sm inline-flex justify-center items-center px-1 bg-red-400">
                              {veryHardSentences.length}
                            </span>
                            {' '}
                            {veryHardSentences.length === 1 
                              ? 'sentence is very hard to read.'
                              : 'sentences are very hard to read.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {hardSentences.length > 0 && (
                      <div className="group rounded p-2 bg-yellow-200">
                        <div className="flex flex-row space-x-1 text-sm text-yellow-900">
                          <p className="flex-1">
                            <span className="font-bold rounded-sm inline-flex justify-center items-center px-1 bg-yellow-400">
                              {hardSentences.length}
                            </span>
                            {' '}
                            {hardSentences.length === 1 
                              ? 'sentence is hard to read.'
                              : 'sentences are hard to read.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SEO Analysis */}
                <div className="border-t border-gray-300 pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">SEO Analysis</h3>
                  <div className="flex items-center mb-4">
                    <div className={`text-2xl font-bold ${seoScore >= 80 ? 'text-green-600' : seoScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {seoScore}%
                    </div>
                  </div>

                  <div className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-600">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => improveReadability(content)}
                    disabled={loading}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {loading ? 'Improving...' : 'Improve with AI'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
