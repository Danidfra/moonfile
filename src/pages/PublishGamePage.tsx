import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSeoMeta } from '@unhead/react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, Link, AlertTriangle, CheckCircle, Copy, Eye } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { ONE_MB } from '@/lib/gamePublishConstants';
import { 
  guessMimeFromFilename, 
  fileToBase64, 
  sha256Hex, 
  generateDTag, 
  generateNakPreview,
  isValidHttpUrl 
} from '@/lib/gamePublishHelpers';

// Form schema
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  version: z.string().min(1, 'Version is required').default('1.0'),
  region: z.string().min(1, 'Region is required'),
  players: z.string().min(1, 'Players is required'),
  year: z.string().min(1, 'Year is required'),
  summary: z.string().optional(),
  credits: z.string().optional(),
  serial: z.string().optional(),
  coverImageUrl: z.string().optional().refine(
    (url) => !url || isValidHttpUrl(url),
    'Cover image URL must be a valid http(s) URL'
  ),
  gameUrl: z.string().optional().refine(
    (url) => !url || isValidHttpUrl(url),
    'Game URL must be a valid http(s) URL'
  ),
});

type FormData = z.infer<typeof formSchema>;

export function PublishGamePage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    size: number;
    sha256: string;
    mime: string;
    platform: string;
    base64?: string;
  } | null>(null);
  const [uploadMode, setUploadMode] = useState<'inline' | 'blossom' | 'url' | null>(null);
  const [blossomUrl, setBlossomUrl] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<{
    kind: number;
    content: string;
    tags: string[][];
  } | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      version: '1.0',
    },
  });

  const { watch, setValue, formState: { errors } } = form;
  const watchedValues = watch();

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setValue('gameUrl', ''); // Clear URL when file is selected
    
    // Calculate file info
    const size = file.size;
    const arrayBuffer = await file.arrayBuffer();
    const sha256 = await sha256Hex(arrayBuffer);
    const mime = guessMimeFromFilename(file.name);
    
    if (!mime) {
      toast({
        title: 'Unsupported file type',
        description: `Cannot determine MIME type for ${file.name}`,
        variant: 'destructive',
      });
      setSelectedFile(null);
      return;
    }

    // Determine platform from MIME
    const platform = mime.replace('application/x-', '').replace('-rom', '') + '-rom';

    // Determine upload mode based on size
    const mode = size <= ONE_MB ? 'inline' : 'blossom';
    setUploadMode(mode);

    // For inline mode, encode to base64
    let base64;
    if (mode === 'inline') {
      base64 = await fileToBase64(file);
    }

    setFileInfo({
      size,
      sha256,
      mime,
      platform,
      base64,
    });

    // Show warning for large files
    if (size > ONE_MB) {
      toast({
        title: 'Large file detected',
        description: 'Files larger than 1MB will be uploaded via Blossom for better performance.',
        variant: 'warning',
      });
    }
  }, [setValue, toast]);

  // Handle URL input
  const handleUrlChange = useCallback((url: string) => {
    setValue('gameUrl', url);
    setSelectedFile(null); // Clear file when URL is entered
    setFileInfo(null);
    if (url) {
      setUploadMode('url');
    } else {
      setUploadMode(null);
    }
  }, [setValue]);

  // Generate preview event
  const generatePreviewEvent = useCallback(async () => {
    const values = form.getValues();
    
    if (!values.title || !values.region || !values.version || !values.players || !values.year) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const dTag = generateDTag(values.title, values.region, values.version);
    
    const tags: string[][] = [
      ['d', dTag],
      ['name', values.title],
      ['region', values.region],
      ['players', values.players],
      ['year', values.year],
      ['ver', values.version],
    ];

    // Add optional fields
    if (values.summary) tags.push(['summary', values.summary]);
    if (values.credits) tags.push(['credits', values.credits]);
    if (values.serial) tags.push(['serial', values.serial]);
    if (values.coverImageUrl) tags.push(['image', 'cover', values.coverImageUrl]);

    let content = '';
    let url = '';

    // Mode-specific tags and content
    if (uploadMode === 'inline' && fileInfo) {
      content = fileInfo.base64 || '';
      tags.push(
        ['mime', fileInfo.mime],
        ['encoding', 'base64'],
        ['platforms', fileInfo.platform],
        ['compression', 'none'],
        ['size', fileInfo.size.toString()],
        ['sha256', fileInfo.sha256]
      );
    } else if (uploadMode === 'blossom' && fileInfo) {
      tags.push(
        ['mime', fileInfo.mime],
        ['encoding', 'url'],
        ['platforms', fileInfo.platform],
        ['compression', 'none'],
        ['size', fileInfo.size.toString()],
        ['sha256', fileInfo.sha256],
        ['url', blossomUrl]
      );
    } else if (uploadMode === 'url' && values.gameUrl) {
      tags.push(
        ['mime', 'text/html'],
        ['encoding', 'url'],
        ['platforms', 'html5'],
        ['compression', 'none'],
        ['url', values.gameUrl]
      );
    }

    const event = {
      kind: 31996,
      content,
      tags,
    };

    setPreviewEvent(event);
    setShowPreview(true);
  }, [form, uploadMode, fileInfo, blossomUrl, toast]);

  // Publish game event
  const handlePublish = useCallback(async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to publish games',
        variant: 'destructive',
      });
      return;
    }

    if (!previewEvent) {
      toast({
        title: 'No preview event',
        description: 'Please generate a preview first',
        variant: 'destructive',
      });
      return;
    }

    try {
      // If blossom mode and no URL yet, upload the file
      if (uploadMode === 'blossom' && selectedFile && !blossomUrl) {
        const tags = await uploadFile(selectedFile);
        const urlTag = tags.find(tag => tag[0] === 'url');
        if (!urlTag) {
          throw new Error('No URL returned from Blossom upload');
        }
        setBlossomUrl(urlTag[1]);
        
        // Update preview event with the URL
        const updatedTags = previewEvent.tags.map(tag => 
          tag[0] === 'url' ? ['url', urlTag[1]] : tag
        );
        const updatedEvent = { ...previewEvent, tags: updatedTags };
        setPreviewEvent(updatedEvent);
        
        // Publish the updated event
        await publishEvent(updatedEvent);
      } else {
        await publishEvent(previewEvent);
      }

      toast({
        title: 'Game published successfully!',
        description: 'Your game is now available on the Nostr network',
      });

      // Reset form
      form.reset();
      setSelectedFile(null);
      setFileInfo(null);
      setUploadMode(null);
      setBlossomUrl('');
      setShowPreview(false);
      setPreviewEvent(null);

    } catch (error) {
      console.error('Publish error:', error);
      toast({
        title: 'Publish failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  }, [user, previewEvent, uploadMode, selectedFile, blossomUrl, uploadFile, publishEvent, form, toast]);

  const isProcessing = isPublishing || isUploading;

  useSeoMeta({
    title: 'Publish Game - MoonFile',
    description: 'Publish your retro games as Nostr events on MoonFile',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Publish Game
          </h1>
          <p className="text-gray-400">
            Share your retro games with the world using Nostr kind 31996 events
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="space-y-6">
            <Card className="border-gray-800 bg-gray-900">
              <CardHeader>
                <CardTitle className="text-white">Game Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title" className="text-white">Title *</Label>
                  <Input
                    id="title"
                    {...form.register('title')}
                    placeholder="Super Mario Bros"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  {errors.title && (
                    <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="version" className="text-white">Version *</Label>
                    <Input
                      id="version"
                      {...form.register('version')}
                      placeholder="1.0"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    {errors.version && (
                      <p className="text-red-400 text-sm mt-1">{errors.version.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="region" className="text-white">Region *</Label>
                    <Input
                      id="region"
                      {...form.register('region')}
                      placeholder="USA"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    {errors.region && (
                      <p className="text-red-400 text-sm mt-1">{errors.region.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="players" className="text-white">Players *</Label>
                    <Input
                      id="players"
                      {...form.register('players')}
                      placeholder="1"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    {errors.players && (
                      <p className="text-red-400 text-sm mt-1">{errors.players.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="year" className="text-white">Year *</Label>
                    <Input
                      id="year"
                      {...form.register('year')}
                      placeholder="1985"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    {errors.year && (
                      <p className="text-red-400 text-sm mt-1">{errors.year.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="summary" className="text-white">Summary</Label>
                  <Textarea
                    id="summary"
                    {...form.register('summary')}
                    placeholder="Game description..."
                    className="bg-gray-800 border-gray-700 text-white"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="credits" className="text-white">Credits</Label>
                  <Input
                    id="credits"
                    {...form.register('credits')}
                    placeholder="Nintendo"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="serial" className="text-white">Serial</Label>
                  <Input
                    id="serial"
                    {...form.register('serial')}
                    placeholder="NES-SM-USA"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="coverImageUrl" className="text-white">Cover Image URL</Label>
                  <Input
                    id="coverImageUrl"
                    {...form.register('coverImageUrl')}
                    placeholder="https://example.com/cover.png"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  {errors.coverImageUrl && (
                    <p className="text-red-400 text-sm mt-1">{errors.coverImageUrl.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Content Source Section */}
            <Card className="border-gray-800 bg-gray-900">
              <CardHeader>
                <CardTitle className="text-white">Game Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-white">Upload ROM File</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".nes,.sfc,.smc,.gba,.gb,.gbc,.n64,.z64,.v64,.nds,.bin,.sms,.gg,.pce,.a26,.a78"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex items-center justify-center w-full p-6 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 transition-colors"
                    >
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-400">
                          {selectedFile ? selectedFile.name : 'Choose ROM file'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          NES, SNES, Game Boy, N64, etc.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="text-center text-gray-500">or</div>

                <div>
                  <Label htmlFor="gameUrl" className="text-white">Web Game URL</Label>
                  <Input
                    id="gameUrl"
                    {...form.register('gameUrl')}
                    placeholder="https://example.com/game.html"
                    className="bg-gray-800 border-gray-700 text-white"
                    onChange={(e) => handleUrlChange(e.target.value)}
                  />
                  {errors.gameUrl && (
                    <p className="text-red-400 text-sm mt-1">{errors.gameUrl.message}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    For HTML5 games that will run in an iframe
                  </p>
                </div>

                {/* File Info */}
                {fileInfo && (
                  <Card className="border-gray-800 bg-gray-800">
                    <CardContent className="p-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Size:</span>
                          <span className="text-white">{fileInfo.size.toLocaleString()} bytes</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">MIME Type:</span>
                          <span className="text-white">{fileInfo.mime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Platform:</span>
                          <span className="text-white">{fileInfo.platform}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">SHA256:</span>
                          <span className="text-white font-mono text-xs">{fileInfo.sha256}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Mode:</span>
                          <span className="text-white">{uploadMode === 'inline' ? 'Inline Base64' : 'Blossom Upload'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Warning for large files */}
                {fileInfo && fileInfo.size > ONE_MB && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Recommended to publish via Blossom to avoid oversized events
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview Section */}
          <div className="space-y-6">
            <Card className="border-gray-800 bg-gray-900">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    onClick={generatePreviewEvent}
                    disabled={!watchedValues.title || !watchedValues.region || !watchedValues.version || !watchedValues.players || !watchedValues.year || isProcessing}
                    className="w-full"
                  >
                    Generate Preview
                  </Button>

                  {showPreview && previewEvent && (
                    <div className="space-y-4">
                      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-green-400 font-medium">Ready to publish</span>
                        </div>
                        <p className="text-sm text-gray-300">
                          Event generated successfully. Review the details below before publishing.
                        </p>
                      </div>

                      <Button
                        onClick={handlePublish}
                        disabled={isProcessing}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        {isProcessing ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {isUploading ? 'Uploading...' : 'Publishing...'}
                          </div>
                        ) : (
                          'Publish Game'
                        )}
                      </Button>

                      {isProcessing && (
                        <Progress value={isUploading ? 50 : 75} className="w-full" />
                      )}
                    </div>
                  )}

                  {previewEvent && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-white font-medium mb-2">Event Preview</h4>
                        <pre className="bg-gray-800 p-4 rounded-lg text-xs text-cyan-400 overflow-x-auto">
                          {JSON.stringify(previewEvent, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <h4 className="text-white font-medium mb-2">nak Command</h4>
                        <div className="bg-gray-800 p-4 rounded-lg">
                          <pre className="text-xs text-cyan-400 overflow-x-auto whitespace-pre-wrap">
                            {generateNakPreview(previewEvent)}
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(generateNakPreview(previewEvent));
                              toast({ title: 'Copied to clipboard' });
                            }}
                            className="mt-2"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {!user && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You need to be logged in to publish games. Please connect your Nostr account.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}