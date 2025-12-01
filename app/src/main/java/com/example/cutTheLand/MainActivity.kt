package com.example.cutTheLand
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        // GitHub Pages 주소를 여기에 넣으세요!
        val myUrl = "https://semilee-ko.github.io/cut-the-world/"
        webView = findViewById(R.id.webview)

        // 웹뷰 설정
        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true // 자바스크립트 허용
        webSettings.domStorageEnabled = true // 로컬 스토리지 허용 (게임 저장용)
        webSettings.loadWithOverviewMode = true
        webSettings.useWideViewPort = true
        // 새 창이 아닌 앱 내에서 열리도록 설정
        webView.webViewClient = WebViewClient()
        // URL 로드
        webView.loadUrl(myUrl)
    }
    // 뒤로가기 버튼 누르면 앱 종료 대신 뒤로가기
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}