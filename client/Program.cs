using System.Drawing;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace NatureScreensaver;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var mode = args.Length > 0 ? args[0].ToLowerInvariant() : "/s";
        if (mode.StartsWith("/c"))
        {
            MessageBox.Show("Nature Screensaver settings are controlled by config.json.", "Nature Screensaver");
            return;
        }
        if (mode.StartsWith("/p"))
        {
            var parent = args.Length > 1 && long.TryParse(args[1], out var handle) ? new IntPtr(handle) : IntPtr.Zero;
            Application.Run(new ScreensaverForm(parent));
            return;
        }
        Application.Run(new ScreensaverForm());
    }
}

public sealed class ScreensaverForm : Form
{
    private readonly PictureBox _picture = new() { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom, BackColor = Color.Black };
    private readonly Label _notice = new() { Dock = DockStyle.Bottom, Height = 36, TextAlign = ContentAlignment.MiddleCenter, ForeColor = Color.White, BackColor = Color.FromArgb(120, 0, 0, 0) };
    private readonly System.Windows.Forms.Timer _slideTimer = new();
    private readonly System.Windows.Forms.Timer _syncTimer = new();
    private readonly string _baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NatureScreensaver");
    private readonly string _cacheDir;
    private readonly IntPtr _previewParent;
    private Config _config = Config.Default();
    private List<string> _images = [];
    private int _index = -1;
    private Point _startMouse;

    public ScreensaverForm(IntPtr previewParent = default)
    {
        _previewParent = previewParent;
        _cacheDir = Path.Combine(_baseDir, "cache");
        Directory.CreateDirectory(_cacheDir);
        FormBorderStyle = FormBorderStyle.None;
        WindowState = _previewParent == IntPtr.Zero ? FormWindowState.Maximized : FormWindowState.Normal;
        TopMost = _previewParent == IntPtr.Zero;
        ShowInTaskbar = _previewParent == IntPtr.Zero;
        BackColor = Color.Black;
        if (_previewParent == IntPtr.Zero) Cursor.Hide();
        Controls.Add(_picture);
        Controls.Add(_notice);
        KeyDown += (_, _) => Close();
        MouseDown += (_, _) => Close();
        MouseMove += (_, e) => { if (_startMouse != Point.Empty && Distance(_startMouse, e.Location) > 8) Close(); };
        Load += (_, _) => AttachPreviewWindow();
        Shown += async (_, _) => { _startMouse = PointToClient(Cursor.Position); await SyncAndStart(); };
        _slideTimer.Tick += (_, _) => ShowNext();
        _syncTimer.Tick += async (_, _) => await SyncAndStart(false);
    }

    private async Task SyncAndStart(bool startTimers = true)
    {
        await LoadLastConfig();
        RefreshImageList();
        ApplyConfigToTimers();

        if (startTimers)
        {
            ShowNext();
            _slideTimer.Start();
            _syncTimer.Start();
        }

        try
        {
            var settings = await LoadLocalSettings();
            if (!string.IsNullOrWhiteSpace(settings.ConfigUrl))
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
                var remote = await http.GetFromJsonAsync<Config>(settings.ConfigUrl);
                if (remote?.Slides?.Count > 0 && ShouldDownload(remote))
                {
                    await DownloadSlides(http, remote);
                    _config = remote;
                    await WriteJson(Path.Combine(_baseDir, "last-config.json"), remote);
                    RefreshImageList();
                    ApplyConfigToTimers();
                    if (_picture.Image == null) ShowNext();
                }
            }
        }
        catch
        {
            RefreshImageList();
            if (_picture.Image == null) ShowNext();
        }
    }

    private async Task LoadLastConfig()
    {
        var last = Path.Combine(_baseDir, "last-config.json");
        if (File.Exists(last)) _config = await ReadJson<Config>(last) ?? _config;
    }

    private bool ShouldDownload(Config remote)
    {
        if (remote.Version != _config.Version) return true;
        return remote.Slides.Any(s => !File.Exists(Path.Combine(_cacheDir, s.FileName)));
    }

    private void RefreshImageList()
    {
        _images = Directory.GetFiles(_cacheDir, "*.png").OrderBy(Path.GetFileName).ToList();
    }

    private void ApplyConfigToTimers()
    {
        _notice.Text = string.IsNullOrWhiteSpace(_config.Notice) ? "Nature Screensaver" : _config.Notice;
        _slideTimer.Interval = Math.Max(5, _config.SlideDurationSeconds) * 1000;
        _syncTimer.Interval = Math.Max(5, _config.UpdateIntervalMinutes) * 60 * 1000;
    }

    private void AttachPreviewWindow()
    {
        if (_previewParent == IntPtr.Zero) return;
        SetParent(Handle, _previewParent);
        GetClientRect(_previewParent, out var rect);
        Bounds = new Rectangle(0, 0, rect.Right - rect.Left, rect.Bottom - rect.Top);
    }

    private async Task<LocalSettings> LoadLocalSettings()
    {
        var path = Path.Combine(_baseDir, "settings.json");
        if (!File.Exists(path))
        {
            var settings = LocalSettings.Default();
            await WriteJson(path, settings);
            return settings;
        }
        return await ReadJson<LocalSettings>(path) ?? LocalSettings.Default();
    }

    private async Task DownloadSlides(HttpClient http, Config config)
    {
        var temp = Path.Combine(_baseDir, "download");
        if (Directory.Exists(temp)) Directory.Delete(temp, true);
        Directory.CreateDirectory(temp);
        foreach (var slide in config.Slides.OrderBy(s => s.Order))
        {
            if (string.IsNullOrWhiteSpace(slide.Url) || string.IsNullOrWhiteSpace(slide.FileName)) continue;
            var bytes = await http.GetByteArrayAsync(slide.Url);
            var safeName = string.Concat(slide.FileName.Split(Path.GetInvalidFileNameChars()));
            await File.WriteAllBytesAsync(Path.Combine(temp, safeName), bytes);
        }
        foreach (var file in Directory.GetFiles(_cacheDir)) File.Delete(file);
        foreach (var file in Directory.GetFiles(temp)) File.Move(file, Path.Combine(_cacheDir, Path.GetFileName(file)), true);
        Directory.Delete(temp, true);
    }

    private void ShowNext()
    {
        if (_images.Count == 0)
        {
            _picture.Image = null;
            _notice.Text = "Screensaver images have not been downloaded yet.";
            return;
        }
        _index = (_index + 1) % _images.Count;
        using var stream = File.OpenRead(_images[_index]);
        var next = Image.FromStream(stream);
        var old = _picture.Image;
        _picture.Image = next;
        old?.Dispose();
    }

    private static async Task<T?> ReadJson<T>(string path)
    {
        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<T>(stream);
    }

    private static async Task WriteJson<T>(string path, T value)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var stream = File.Create(path);
        await JsonSerializer.SerializeAsync(stream, value, new JsonSerializerOptions { WriteIndented = true });
    }

    private static double Distance(Point a, Point b)
    {
        var dx = a.X - b.X;
        var dy = a.Y - b.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    [DllImport("user32.dll")]
    private static extern IntPtr SetParent(IntPtr child, IntPtr newParent);

    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}

public sealed class LocalSettings
{
    [JsonPropertyName("configUrl")] public string ConfigUrl { get; set; } = "";
    public static LocalSettings Default() => new();
}

public sealed class Config
{
    [JsonPropertyName("version")] public string Version { get; set; } = "local";
    [JsonPropertyName("updateIntervalMinutes")] public int UpdateIntervalMinutes { get; set; } = 60;
    [JsonPropertyName("slideDurationSeconds")] public int SlideDurationSeconds { get; set; } = 20;
    [JsonPropertyName("notice")] public string Notice { get; set; } = "";
    [JsonPropertyName("slides")] public List<Slide> Slides { get; set; } = [];
    public static Config Default() => new();
}

public sealed class Slide
{
    [JsonPropertyName("order")] public int Order { get; set; }
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("fileName")] public string FileName { get; set; } = "";
    [JsonPropertyName("url")] public string Url { get; set; } = "";
}
