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
import { Upload, AlertTriangle, CheckCircle, Copy, Eye } from 'lucide-react';
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
  isValidHttpUrl,
  platformFromMime,
  mergePlatforms,
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
  status: z.enum(['released', 'beta', 'alpha', 'prototype']).default('released'),
  publisher: z.string().min(1, 'Publisher is required'),
  crc: z.string().optional().refine(
    (val) => !val || /^[0-9a-fA-F]{8}$/.test(val),
    'CRC must be 8 hex chars'
  ),
  modes: z.array(z.enum(['singleplayer','multiplayer','co-op','competitive'])).optional(),
  genresCsv: z.string().optional(),
  extraPlatforms: z.string().optional(),
  relaysRaw: z.string().min(1, 'At least one relay is required'),
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
      status: 'released',
      relaysRaw: 'wss://relay.ditto.pub'
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

    // Determine platform from MIME (ex.: "application/x-snes-rom" -> "snes-rom")
    const platform = platformFromMime(mime);

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
        variant: 'default',
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

  function platformsTag(base: string, extra?: string) {
    const extras = (extra ?? '')
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);
    const unique = Array.from(new Set([base, ...extras]));
    return ['platforms', ...unique] as string[];
  }

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

    const dTag = generateDTag(values.title, values.region, values.version, values.publisher);
    
    const tags: string[][] = [
      ['d', dTag],
      ['name', values.title],
      ['region', values.region],
      ['players', values.players],
      ['year', values.year],
      ['ver', values.version],
      ['status', values.status],
      ['publisher', values.publisher],
    ];

    // Add optional fields
    if (values.summary) tags.push(['summary', values.summary]);
    if (values.credits) tags.push(['credits', values.credits]);
    if (values.serial) tags.push(['serial', values.serial]);
    if (values.coverImageUrl) tags.push(['image', values.coverImageUrl]);
    if (values.crc) tags.push(['crc', values.crc.toLowerCase()]);

    // Modes -> t=...
    if (values.modes?.length) {
      for (const m of values.modes) tags.push(['mode', m]);
    }
    // Genres CSV -> t=...
    if (values.genresCsv) {
      values.genresCsv
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(g => tags.push(['genre', g]));
    }

    let content = '';

    // Mode-specific tags and content
    if (uploadMode === 'inline' && fileInfo) {
      content = fileInfo.base64 || '';
      const platforms = mergePlatforms(fileInfo.platform, values.extraPlatforms);
      tags.push(
        ['mime', fileInfo.mime],
        ['encoding', 'base64'],
        ['platforms', platforms],
        ['compression', 'none'],
        ['size', String(fileInfo.size)],
        ['sha256', fileInfo.sha256]
      );
    } else if (uploadMode === 'blossom' && fileInfo) {
      const platforms = mergePlatforms(fileInfo.platform, values.extraPlatforms);
      tags.push(
        ['mime', fileInfo.mime],
        ['encoding', 'url'],
        ['platforms', platforms],
        ['compression', 'none'],
        ['size', String(fileInfo.size)],
        ['sha256', fileInfo.sha256],
        ['url', blossomUrl]
      );
    } else if (uploadMode === 'url' && values.gameUrl) {
      tags.push(
        ['mime', 'text/html'],
        ['encoding', 'url'],
        platformsTag('html5', values.extraPlatforms),
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
      const relays = parseRelays(form.getValues('relaysRaw'));
      if (!relays.length) {
        toast({
          title: 'No relays',
          description: 'Add at least one relay',
          variant: 'destructive',
        });
        return;
      }
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
        
        // Publish the updated event (com relays)
        await publishEvent({...updatedEvent, relays });
      } else {
        await publishEvent({...previewEvent, relays });
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

  const parseRelays = (raw: string): string[] =>
    raw
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.startsWith('ws://') || s.startsWith('wss://') ? s : `wss://${s}`);

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

                {/* Status */}
                <div>
                  <Label htmlFor="status" className="text-white">Status *</Label>
                  <select
                    id="status"
                    {...form.register('status')}
                    className="mt-1 w-full rounded-md bg-gray-800 border border-gray-700 text-white p-2"
                  >
                    <option value="released">released</option>
                    <option value="beta">beta</option>
                    <option value="alpha">alpha</option>
                    <option value="prototype">prototype</option>
                  </select>
                  {errors.status && (
                    <p className="text-red-400 text-sm mt-1">{String(errors.status.message)}</p>
                  )}
                </div>

                {/* Publisher */}
                <div>
                  <Label htmlFor="publisher" className="text-white">Publisher *</Label>
                  <Input
                    id="publisher"
                    {...form.register('publisher')}
                    placeholder="Nintendo"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  {errors.publisher && (
                    <p className="text-red-400 text-sm mt-1">{errors.publisher.message}</p>
                  )}
                </div>

                {/* CRC */}
                <div>
                  <div>
                    <Label htmlFor="crc" className="text-white">CRC (8 hex)</Label>
                    <Input
                      id="crc"
                      {...form.register('crc')}
                      placeholder="9c1f11e4"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    {errors.crc && (
                      <p className="text-red-400 text-sm mt-1">{errors.crc.message}</p>
                    )}
                  </div>
                </div>

                {/* Modes (t=...) */}
                <div>
                  <Label className="text-white">Modes (adds "t=" tags)</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-white">
                    {(['singleplayer','multiplayer','co-op','competitive'] as const).map(m => (
                      <label key={m} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          value={m}
                          {...form.register('modes')}
                          className="h-4 w-4"
                        />
                        <span>{m}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Genres CSV -> t=... */}
                <div>
                  <Label htmlFor="genresCsv" className="text-white">Genres (comma-separated)</Label>
                  <Input
                    id="genresCsv"
                    {...form.register('genresCsv')}
                    placeholder="action, puzzle"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                {/* Extra platforms (semicolon-separated) */}
                <div>
                  <Label htmlFor="extraPlatforms" className="text-white">Extra platforms (semicolon-separated)</Label>
                  <Input
                    id="extraPlatforms"
                    {...form.register('extraPlatforms')}
                    placeholder="html5"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    These will be appended to the base platform (e.g., "snes-rom;html5").
                  </p>
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
                          <span className="text-white font-mono text-xs truncate">{fileInfo.sha256}</span>
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

    
            {/* Publishing Options */}
            <Card className="border-gray-800 bg-gray-900">
              <CardHeader>
                <CardTitle className="text-white">Publishing Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="relaysRaw" className="text-white">Relays *</Label>
                  <Textarea
                    id="relaysRaw"
                    {...form.register('relaysRaw')}
                    rows={3}
                    placeholder={`wss://relay.ditto.pub\nwss://relay.primal.net`}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  {errors.relaysRaw && (
                    <p className="text-red-400 text-sm mt-1">{errors.relaysRaw.message}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">One relay per line. We’ll prefix “wss://” if missing.</p>
                </div>
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
                {/* Botão para gerar o preview */}
                <Button
                  type="button"
                  onClick={generatePreviewEvent}
                  disabled={
                    !watchedValues.title ||
                    !watchedValues.region ||
                    !watchedValues.version ||
                    !watchedValues.players ||
                    !watchedValues.year ||
                    isProcessing
                  }
                  className="w-full"
                >
                  Generate Preview
                </Button>

                {/* Mostra resultado + seções colapsáveis */}
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

                    {/* Event JSON (colapsado) */}
                    <details className="group rounded-md border border-gray-800 bg-gray-800/60">
                      <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-sm text-white hover:bg-gray-800/80">
                        <span>Event Preview (JSON)</span>
                        <span className="text-xs text-gray-400 group-open:hidden">Show</span>
                        <span className="text-xs text-gray-400 hidden group-open:inline">Hide</span>
                      </summary>
                      <div className="px-4 pb-4">
                        <pre className="bg-gray-900 p-4 rounded-lg text-xs text-cyan-400 overflow-x-auto">
                          {JSON.stringify(previewEvent, null, 2)}
                        </pre>
                      </div>
                    </details>

                    {/* nak Command (colapsado) */}
                    <details className="group rounded-md border border-gray-800 bg-gray-800/60">
                      <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-sm text-white hover:bg-gray-800/80">
                        <span>nak Command</span>
                        <span className="text-xs text-gray-400 group-open:hidden">Show</span>
                        <span className="text-xs text-gray-400 hidden group-open:inline">Hide</span>
                      </summary>
                      <div className="px-4 pb-4">
                        <pre className="bg-gray-900 p-4 rounded-lg text-xs text-cyan-400 overflow-x-auto whitespace-pre-wrap">
                          {generateNakPreview(previewEvent)}
                        </pre>
                        <Button
                          type="button"
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
                    </details>

                    {/* Botão de publicar abaixo do preview */}
                    <Button
                      type="button"
                      onClick={handlePublish}
                      disabled={!user || isProcessing}
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