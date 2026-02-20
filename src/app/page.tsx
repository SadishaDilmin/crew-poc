"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type WorkflowType = "project" | "code-review" | "qa-tests" | "bug-analysis";

interface GitHubUser {
  id: string;
  login: string;
  avatar_url: string;
  name: string;
}

interface Repo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  language: string;
  updated_at: string;
  default_branch: string;
}

interface FileItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
}

export default function Home() {
  // GitHub Auth State
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubUserId, setGithubUserId] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [repoContents, setRepoContents] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingContents, setLoadingContents] = useState(false);

  // App State
  const [activeTab, setActiveTab] = useState<WorkflowType>("code-review");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  // Form States
  const [idea, setIdea] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto-detect");
  const [codeContext, setCodeContext] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [testType, setTestType] = useState("all");
  const [bugDescription, setBugDescription] = useState("");
  const [errorLogs, setErrorLogs] = useState("");

  // Check for GitHub callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("github_user_id");
    const login = params.get("github_login");
    
    if (userId && login) {
      setGithubUserId(userId);
      localStorage.setItem("github_user_id", userId);
      // Clean URL
      window.history.replaceState({}, "", "/");
      fetchUserInfo(userId);
    } else {
      // Check localStorage
      const savedUserId = localStorage.getItem("github_user_id");
      if (savedUserId) {
        setGithubUserId(savedUserId);
        fetchUserInfo(savedUserId);
      }
    }
  }, []);

  const fetchUserInfo = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/github/user/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setGithubUser(data.user);
      } else {
        localStorage.removeItem("github_user_id");
        setGithubUserId(null);
      }
    } catch {
      localStorage.removeItem("github_user_id");
    }
  };

  const handleGitHubLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/github/login`);
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Failed to initiate GitHub login", error);
    }
  };

  const handleGitHubLogout = () => {
    localStorage.removeItem("github_user_id");
    setGithubUser(null);
    setGithubUserId(null);
    setRepos([]);
    setSelectedRepo(null);
    setSelectedFile(null);
  };

  const fetchRepos = async () => {
    if (!githubUserId) return;
    setLoadingRepos(true);
    try {
      const res = await fetch(`${API_URL}/auth/github/repos/${githubUserId}`);
      const data = await res.json();
      setRepos(data.repos);
    } catch (error) {
      console.error("Failed to fetch repos", error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const fetchRepoContents = async (repo: Repo, path: string = "") => {
    if (!githubUserId) return;
    setLoadingContents(true);
    try {
      const [owner, repoName] = repo.full_name.split("/");
      const res = await fetch(
        `${API_URL}/auth/github/repos/${githubUserId}/${owner}/${repoName}/contents?path=${path}`
      );
      const data = await res.json();
      if (data.type === "directory") {
        setRepoContents(data.contents);
      }
    } catch (error) {
      console.error("Failed to fetch contents", error);
    } finally {
      setLoadingContents(false);
    }
  };

  const handleSelectRepo = (repo: Repo) => {
    setSelectedRepo(repo);
    setCurrentPath([]);
    setSelectedFile(null);
    fetchRepoContents(repo);
  };

  const handleNavigate = (item: FileItem) => {
    if (!selectedRepo) return;
    
    if (item.type === "dir") {
      setCurrentPath([...currentPath, item.name]);
      fetchRepoContents(selectedRepo, item.path);
    } else {
      selectFile(item.path);
    }
  };

  const handleGoBack = () => {
    if (!selectedRepo || currentPath.length === 0) {
      setSelectedRepo(null);
      setRepoContents([]);
      return;
    }
    
    const newPath = [...currentPath];
    newPath.pop();
    setCurrentPath(newPath);
    fetchRepoContents(selectedRepo, newPath.join("/"));
  };

  const selectFile = async (path: string) => {
    if (!githubUserId || !selectedRepo) return;
    
    try {
      const [owner, repoName] = selectedRepo.full_name.split("/");
      const res = await fetch(
        `${API_URL}/auth/github/repos/${githubUserId}/${owner}/${repoName}/file?path=${path}`
      );
      const data = await res.json();
      setSelectedFile(path);
      setSelectedFileContent(data.content);
      setCode(data.content);
      setShowFilePicker(false);
    } catch (error) {
      console.error("Failed to fetch file", error);
    }
  };

  const openFilePicker = () => {
    setShowFilePicker(true);
    if (repos.length === 0) {
      fetchRepos();
    }
  };

  // API Calls
  const analyzeProject = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch(`${API_URL}/analyze-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      setResult(data.result || data.detail || "Error occurred");
    } catch {
      setResult("Error connecting to backend. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const reviewCode = async () => {
    setLoading(true);
    setResult("");
    
    try {
      let body: Record<string, unknown> = { language, context: codeContext };
      
      if (selectedFile && githubUserId && selectedRepo) {
        const [owner, repoName] = selectedRepo.full_name.split("/");
        body = {
          ...body,
          github_auth: {
            user_id: githubUserId,
            owner,
            repo: repoName,
            path: selectedFile,
          },
        };
      } else {
        body.code = code;
      }
      
      const res = await fetch(`${API_URL}/v2/code-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult(data.result || data.detail || "Error occurred");
    } catch {
      setResult("Error connecting to backend. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const generateTests = async () => {
    setLoading(true);
    setResult("");
    
    try {
      let body: Record<string, unknown> = {
        feature_description: featureDescription,
        test_type: testType,
      };
      
      if (selectedFile && githubUserId && selectedRepo) {
        const [owner, repoName] = selectedRepo.full_name.split("/");
        body.github_auth = {
          user_id: githubUserId,
          owner,
          repo: repoName,
          path: selectedFile,
        };
      } else if (code) {
        body.code = code;
      }
      
      const res = await fetch(`${API_URL}/v2/generate-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult(data.result || data.detail || "Error occurred");
    } catch {
      setResult("Error connecting to backend. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const analyzeBug = async () => {
    setLoading(true);
    setResult("");
    
    try {
      let body: Record<string, unknown> = {
        bug_description: bugDescription,
        error_logs: errorLogs,
      };
      
      if (selectedFile && githubUserId && selectedRepo) {
        const [owner, repoName] = selectedRepo.full_name.split("/");
        body.github_auth = {
          user_id: githubUserId,
          owner,
          repo: repoName,
          path: selectedFile,
        };
      } else if (code) {
        body.code = code;
      }
      
      const res = await fetch(`${API_URL}/v2/analyze-bug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult(data.result || data.detail || "Error occurred");
    } catch {
      setResult("Error connecting to backend. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    switch (activeTab) {
      case "project":
        analyzeProject();
        break;
      case "code-review":
        reviewCode();
        break;
      case "qa-tests":
        generateTests();
        break;
      case "bug-analysis":
        analyzeBug();
        break;
    }
  };

  const isSubmitDisabled = () => {
    if (loading) return true;
    switch (activeTab) {
      case "project":
        return !idea.trim();
      case "code-review":
        return !code.trim() && !selectedFile;
      case "qa-tests":
        return !featureDescription.trim();
      case "bug-analysis":
        return !bugDescription.trim();
    }
  };

  const tabs = [
    { id: "code-review" as WorkflowType, label: "Code Review" },
    { id: "qa-tests" as WorkflowType, label: "Generate Tests" },
    { id: "bug-analysis" as WorkflowType, label: "Bug Analysis" },
    { id: "project" as WorkflowType, label: "Project Ideas" },
  ];

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border)] sticky top-0 bg-[var(--background)] z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--foreground)] rounded-lg flex items-center justify-center">
              <span className="text-[var(--background)] font-bold text-sm">AI</span>
            </div>
            <div>
              <h1 className="font-semibold">CrewAI Code Assistant</h1>
              <p className="text-xs text-[var(--muted)]">AI-powered code analysis</p>
            </div>
          </div>
          
          {/* GitHub Auth */}
          <div className="flex items-center gap-4">
            {githubUser ? (
              <div className="flex items-center gap-3">
                <img
                  src={githubUser.avatar_url}
                  alt={githubUser.login}
                  className="w-8 h-8 rounded-full border border-[var(--border)]"
                />
                <span className="text-sm font-medium">{githubUser.login}</span>
                <button
                  onClick={handleGitHubLogout}
                  className="btn-secondary text-sm px-3 py-1"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={handleGitHubLogin} className="btn-secondary flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd"/>
                </svg>
                Connect GitHub
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 border-b border-[var(--border)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setResult("");
              }}
              className={`px-4 py-3 text-sm font-medium transition-all relative ${
                activeTab === tab.id
                  ? "text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--foreground)]" />
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Input */}
          <div className="space-y-6">
            {/* GitHub File Picker Button */}
            {githubUser && activeTab !== "project" && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium">Select from GitHub</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {selectedFile
                        ? `Selected: ${selectedFile}`
                        : "Choose a file from your repositories"}
                    </p>
                  </div>
                  <button onClick={openFilePicker} className="btn-secondary">
                    {selectedFile ? "Change File" : "Browse Files"}
                  </button>
                </div>
                
                {selectedFile && (
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setSelectedFileContent("");
                      setCode("");
                    }}
                    className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            )}

            {/* Project Analysis */}
            {activeTab === "project" && (
              <div className="space-y-4 fade-in">
                <div className="card">
                  <h3 className="font-medium mb-2">Project Idea Analysis</h3>
                  <p className="text-sm text-[var(--muted)] mb-4">
                    AI agents will analyze feasibility, create development plans, and provide recommendations.
                  </p>
                  <textarea
                    className="input-field font-mono text-sm"
                    placeholder="Describe your project idea in detail..."
                    rows={8}
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Code Review */}
            {activeTab === "code-review" && (
              <div className="space-y-4 fade-in">
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Code to Review</h3>
                    <select
                      className="input-field w-auto text-sm"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="auto-detect">Auto Detect</option>
                      <option value="javascript">JavaScript</option>
                      <option value="typescript">TypeScript</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                      <option value="go">Go</option>
                      <option value="rust">Rust</option>
                    </select>
                  </div>
                  <textarea
                    className="input-field font-mono text-sm"
                    placeholder={selectedFile ? "File content loaded from GitHub..." : "Paste your code here or select from GitHub..."}
                    rows={12}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="card">
                  <label className="block text-sm font-medium mb-2">Context (optional)</label>
                  <textarea
                    className="input-field text-sm"
                    placeholder="What does this code do? Any specific concerns?"
                    rows={2}
                    value={codeContext}
                    onChange={(e) => setCodeContext(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* QA Tests */}
            {activeTab === "qa-tests" && (
              <div className="space-y-4 fade-in">
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Test Generation</h3>
                    <select
                      className="input-field w-auto text-sm"
                      value={testType}
                      onChange={(e) => setTestType(e.target.value)}
                    >
                      <option value="all">All Test Types</option>
                      <option value="unit">Unit Tests</option>
                      <option value="integration">Integration Tests</option>
                      <option value="e2e">E2E Tests</option>
                    </select>
                  </div>
                  <textarea
                    className="input-field text-sm mb-4"
                    placeholder="Describe the feature you want to test..."
                    rows={4}
                    value={featureDescription}
                    onChange={(e) => setFeatureDescription(e.target.value)}
                  />
                  <label className="block text-sm font-medium mb-2">Related Code</label>
                  <textarea
                    className="input-field font-mono text-sm"
                    placeholder={selectedFile ? "File content loaded from GitHub..." : "Paste code or select from GitHub..."}
                    rows={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Bug Analysis */}
            {activeTab === "bug-analysis" && (
              <div className="space-y-4 fade-in">
                <div className="card">
                  <h3 className="font-medium mb-4">Bug Analysis</h3>
                  <textarea
                    className="input-field text-sm mb-4"
                    placeholder="Describe the bug in detail..."
                    rows={4}
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                  />
                  <label className="block text-sm font-medium mb-2">Error Logs</label>
                  <textarea
                    className="input-field font-mono text-sm mb-4"
                    placeholder="Paste error logs or stack traces..."
                    rows={4}
                    value={errorLogs}
                    onChange={(e) => setErrorLogs(e.target.value)}
                  />
                  <label className="block text-sm font-medium mb-2">Related Code</label>
                  <textarea
                    className="input-field font-mono text-sm"
                    placeholder={selectedFile ? "File content loaded from GitHub..." : "Paste code or select from GitHub..."}
                    rows={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              className="btn-primary w-full"
              onClick={handleSubmit}
              disabled={isSubmitDisabled()}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Processing with AI Agents...
                </span>
              ) : (
                <>
                  {activeTab === "project" && "Analyze Project"}
                  {activeTab === "code-review" && "Review Code"}
                  {activeTab === "qa-tests" && "Generate Tests"}
                  {activeTab === "bug-analysis" && "Analyze Bug"}
                </>
              )}
            </button>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            <div className="card min-h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Results</h3>
                {result && (
                  <button
                    onClick={() => navigator.clipboard.writeText(result)}
                    className="btn-secondary text-sm px-3 py-1"
                  >
                    Copy
                  </button>
                )}
              </div>
              {loading ? (
                <div className="flex flex-col items-center justify-center h-80 text-[var(--muted)]">
                  <div className="loading-pulse">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <p className="mt-4 text-sm">AI agents are working...</p>
                  <p className="text-xs mt-1">This may take 1-3 minutes</p>
                </div>
              ) : result ? (
                <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-[600px] p-4 bg-[var(--hover)] rounded-lg">
                  {result}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 text-[var(--muted)]">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <p className="mt-4 text-sm">Results will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Picker Modal */}
      {showFilePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden fade-in">
            <div className="border-b border-[var(--border)] p-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Select File from GitHub</h2>
                <p className="text-sm text-[var(--muted)]">
                  {selectedRepo
                    ? `${selectedRepo.full_name} / ${currentPath.join("/")}`
                    : "Choose a repository"}
                </p>
              </div>
              <button
                onClick={() => setShowFilePicker(false)}
                className="p-2 hover:bg-[var(--hover)] rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <div className="p-4 overflow-auto max-h-[60vh]">
              {loadingRepos || loadingContents ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              ) : !selectedRepo ? (
                <div className="space-y-2">
                  {repos.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={() => handleSelectRepo(repo)}
                      className="w-full text-left p-3 rounded-lg border border-[var(--border)] hover:border-[var(--foreground)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                        </svg>
                        <span className="font-medium">{repo.name}</span>
                        {repo.private && (
                          <span className="text-xs px-1.5 py-0.5 bg-[var(--hover)] rounded">Private</span>
                        )}
                        {repo.language && (
                          <span className="text-xs text-[var(--muted)]">{repo.language}</span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-sm text-[var(--muted)] mt-1 truncate">{repo.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    onClick={handleGoBack}
                    className="file-item w-full text-left text-[var(--muted)]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12"/>
                    </svg>
                    <span>..</span>
                  </button>
                  {repoContents.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item)}
                      className={`file-item w-full text-left ${
                        item.type === "file" ? "hover:bg-[var(--hover)]" : ""
                      }`}
                    >
                      {item.type === "dir" ? (
                        <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      )}
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-6xl mx-auto px-6 pb-10 pt-6 text-xs text-[var(--muted)] border-t border-[var(--border)]">
        Developed by Sadisha
      </footer>
    </main>
  );
}

