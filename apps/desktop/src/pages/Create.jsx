import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import '../App.css';

import {
    Sidebar,
    ReviewMode,
    GeneratingView,
    BoardsView,
    ResearchPanel,
    Lightbox
} from '../components';
import { useLocalStorage, useStoryGeneration, useBoards, useProviders } from '../hooks';

function Create({ openResearchTopic, onResearchOpened }) {
    // Form state
    const [topic, setTopic] = useState('');
    const [numSlides, setNumSlides] = useState(5);
    const [selectedStyle, setSelectedStyle] = useState(null);
    const [customStyles, setCustomStyles] = useLocalStorage('story-generator-custom-styles', []);
    const [imageSize, setImageSize] = useState('story');
    const [imageProvider, setImageProvider] = useState('fal');
    const [llmProvider, setLlmProvider] = useState('gemini');
    const [inputMode, setInputMode] = useState('topic');
    const [pastedText, setPastedText] = useState('');

    // Brand state
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState(null);

    // Lightbox state
    const [selectedImage, setSelectedImage] = useState(null);

    // Provider status (LLM, Vision, Image)
    const { providers: providerStatus } = useProviders();

    // Boards state (persisted to backend)
    const {
        savedResearch,
        savedImageBoards,
        loading: boardsLoading,
        addResearch,
        updateResearch,
        deleteResearch,
        addImageBoard,
        updateImageBoard,
        deleteImageBoard,
        refreshBoards,
    } = useBoards();

    // Refresh boards on mount and when window gains focus
    useEffect(() => {
        // Refresh on mount to ensure latest data
        refreshBoards();

        const handleFocus = () => refreshBoards();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshBoards();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refreshBoards]);

    const [activeTab, setActiveTab] = useState('research');
    const [selectedBoard, setSelectedBoard] = useState(null);
    const [selectedResearchBoard, setSelectedResearchBoard] = useState(null);

    // Load brands on mount
    useEffect(() => {
        const loadBrands = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/brands');
                if (response.ok) {
                    const data = await response.json();
                    setBrands(data.brands || []);
                }
            } catch (err) {
                console.error('Failed to load brands:', err);
            }
        };
        loadBrands();
    }, []);

    // Handle opening a specific research from wiki-link
    useEffect(() => {
        if (openResearchTopic && savedResearch.length > 0) {
            // Find matching research by topic
            const matchingResearch = savedResearch.find(
                r => r.topic?.toLowerCase() === openResearchTopic.toLowerCase()
            );
            if (matchingResearch) {
                setActiveTab('research');
                setSelectedResearchBoard(matchingResearch);
            }
            // Clear the trigger
            if (onResearchOpened) {
                onResearchOpened();
            }
        }
    }, [openResearchTopic, savedResearch, onResearchOpened]);

    // Story generation hook
    const {
        isGenerating,
        generatingPhase,
        storyPlan,
        setStoryPlan,
        expectedSlides,
        currentGeneratingSlide,
        setCurrentGeneratingSlide,
        generatingSlides,
        generatedImages,
        generatedSlides,
        storyCaption,
        storyHashtags,
        completedResearch,
        setCompletedResearch,
        researchCollapsed,
        setResearchCollapsed,
        handleGenerate,
        handleConfirmPlan,
        handleRegenerateImages,
        handleEditAesthetic,
        handleEditSlide,
        handleDeleteSlide,
        handleAddSlide,
        handleEditCaption,
        handleCancel,
        updatePlanStyle
    } = useStoryGeneration({
        topic,
        numSlides,
        selectedStyle,
        imageSize,
        imageProvider,
        llmProvider,
        inputMode,
        pastedText,
        brandId: selectedBrand,
        onSaveResearch: (board) => addResearch(board),
        onSaveImages: (board) => {
            addImageBoard(board);
            setSelectedBoard(board);
            setActiveTab('images');
        }
    });

    // Update plan style when style changes (during review/generation)
    useEffect(() => {
        if (storyPlan && selectedStyle) {
            updatePlanStyle(selectedStyle);
        }
    }, [selectedStyle]);

    // Download handlers
    const handleDownloadImage = async (imageUrl, index) => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Try Tauri's native save dialog
            if (window.__TAURI__) {
                const { save } = await import('@tauri-apps/api/dialog');
                const { writeBinaryFile } = await import('@tauri-apps/api/fs');

                const filePath = await save({
                    defaultPath: `slide_${index + 1}.png`,
                    filters: [{ name: 'Images', extensions: ['png'] }]
                });

                if (filePath) {
                    await writeBinaryFile(filePath, uint8Array);
                }
            } else {
                // Fallback for browser
                saveAs(blob, `slide_${index + 1}.png`);
            }
        } catch (err) {
            console.error('Download failed:', err);
            // Ultimate fallback: open in new tab
            window.open(imageUrl, '_blank');
        }
    };

    const handleDownloadAll = async (images, topicName = 'story') => {
        const safeName = topicName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        try {
            // If only 1 image, download directly
            if (images.length === 1) {
                await handleDownloadImage(images[0], 0);
                return;
            }

            // Multiple images - create zip
            const zip = new JSZip();
            const folder = zip.folder('images');

            for (let i = 0; i < images.length; i++) {
                try {
                    const response = await fetch(images[i]);
                    const blob = await response.blob();
                    folder.file(`slide_${i + 1}.png`, blob);
                } catch (err) {
                    console.error(`Failed to add image ${i + 1} to zip:`, err);
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });

            // Try Tauri's native save dialog
            if (window.__TAURI__) {
                const { save } = await import('@tauri-apps/api/dialog');
                const { writeBinaryFile } = await import('@tauri-apps/api/fs');

                const filePath = await save({
                    defaultPath: `${safeName}_images.zip`,
                    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
                });

                if (filePath) {
                    const arrayBuffer = await content.arrayBuffer();
                    await writeBinaryFile(filePath, new Uint8Array(arrayBuffer));
                }
            } else {
                saveAs(content, `${safeName}_images.zip`);
            }
        } catch (err) {
            console.error('Download all failed:', err);
        }
    };

    // Delete handlers
    const handleDeleteResearch = (researchId) => {
        deleteResearch(researchId);
    };

    const handleDeleteImages = (boardId) => {
        deleteImageBoard(boardId);
    };

    // Delete a single image from a board
    const handleDeleteSingleImage = async (boardId, imageIndex) => {
        const board = savedImageBoards.find(b => b.id === boardId);
        if (!board) return;

        const newImages = [...board.images];
        newImages.splice(imageIndex, 1);

        // If no images left, delete the whole board
        if (newImages.length === 0) {
            deleteImageBoard(boardId);
            setSelectedBoard(null);
            return;
        }

        // Update the board with remaining images
        const updatedBoard = {
            ...board,
            images: newImages,
            updatedAt: new Date().toISOString()
        };

        await updateImageBoard(updatedBoard);
        setSelectedBoard(updatedBoard);
    };

    // Store source research for back navigation
    const [sourceResearch, setSourceResearch] = useState(null);

    // Open review mode for regeneration from research board
    const handleReviewForRegenerate = (research) => {
        setSourceResearch(research); // Store for back navigation
        setSelectedResearchBoard(null);
        // Format research as storyPlan to trigger ReviewMode
        // Use selectedStyle from sidebar if available, otherwise use research's aesthetic
        setStoryPlan({
            topic: research.topic,
            aesthetic: selectedStyle || research.aesthetic,
            slides: research.slides,
            caption: research.caption,
            hashtags: research.hashtags,
            sources: research.sources,
            image_size: research.image_size || imageSize,
            isFromResearch: true,  // Flag to know this came from saved research
            sourceResearchId: research.id  // Store the source ID
        });
    };

    // Go back from ReviewMode to Research detail
    const handleBackFromReview = () => {
        if (sourceResearch) {
            setSelectedResearchBoard(sourceResearch);
            setSourceResearch(null);
        }
        setStoryPlan(null);
    };

    // Confirm plan and set board
    const handleConfirmAndSetBoard = async (filteredPlan = null) => {
        const newBoard = await handleConfirmPlan(filteredPlan);
        if (newBoard) {
            setSelectedBoard(newBoard);
            setActiveTab('images');
        }
    };

    // Save just the research without generating images
    const handleSaveResearchOnly = () => {
        if (!storyPlan) return;

        const researchBoard = {
            id: Date.now(),
            topic: storyPlan.topic,
            aesthetic: storyPlan.aesthetic,
            slides: storyPlan.slides,
            sources: storyPlan.sources || [],
            caption: storyPlan.caption,
            hashtags: storyPlan.hashtags,
            image_size: imageSize || storyPlan.image_size || 'story',
            provider: storyPlan.provider || llmProvider,
            model: storyPlan.model,
            createdAt: new Date().toISOString()
        };

        addResearch(researchBoard);
        setStoryPlan(null); // Clear plan to go back to boards view
        setActiveTab('research'); // Switch to research tab
    };

    // Add more slides to existing research
    const handleAddMoreSlides = async (research, additionalCount) => {
        if (!research || additionalCount <= 0) return;

        try {
            const response = await fetch('http://127.0.0.1:8000/add_slides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: research.topic,
                    existing_slides: research.slides,
                    additional_count: additionalCount,
                    aesthetic: selectedStyle || research.aesthetic
                }),
            });

            if (!response.ok) throw new Error('Failed to add slides');

            const data = await response.json();

            // Update the research board with new slides
            const updatedResearch = {
                ...research,
                slides: data.slides,
                sources: [...(research.sources || []), ...(data.new_sources || [])]
            };

            // Update in backend
            await fetch(`http://127.0.0.1:8000/boards/research/${research.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedResearch),
            });

            // Update local state
            updateResearch(updatedResearch);
            setSelectedResearchBoard(updatedResearch);

        } catch (err) {
            console.error('Failed to add slides:', err);
            alert('Failed to add more slides. Please try again.');
        }
    };

    // Update research (edit slides, delete slides, add manual slides)
    const handleUpdateResearch = async (updatedResearch) => {
        if (!updatedResearch) return;

        try {
            // Update in backend
            await fetch(`http://127.0.0.1:8000/boards/research/${updatedResearch.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedResearch),
            });

            // Update local state
            updateResearch(updatedResearch);
        } catch (err) {
            console.error('Failed to update research:', err);
        }
    };

    // Determine main content view
    const renderMainContent = () => {
        // Review mode - show plan for editing (takes priority)
        if (storyPlan && !generatedImages.length && !isGenerating) {
            return (
                <ReviewMode
                    storyPlan={storyPlan}
                    selectedStyle={selectedStyle}
                    onEditAesthetic={handleEditAesthetic}
                    onEditCaption={handleEditCaption}
                    onConfirmPlan={handleConfirmAndSetBoard}
                    onSaveResearch={handleSaveResearchOnly}
                    onBack={handleBackFromReview}
                />
            );
        }

        // Generating view - show progress
        if (isGenerating) {
            return (
                <div className="generation-live">
                    <GeneratingView
                        generatingPhase={generatingPhase}
                        topic={topic}
                        currentGeneratingSlide={currentGeneratingSlide}
                        setCurrentGeneratingSlide={setCurrentGeneratingSlide}
                        expectedSlides={expectedSlides}
                        generatingSlides={generatingSlides}
                    />
                </div>
            );
        }

        // Loading state for boards
        if (boardsLoading) {
            return (
                <div className="empty-state">
                    <p>Loading...</p>
                </div>
            );
        }

        // Default - show boards
        return (
            <BoardsView
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                savedResearch={savedResearch}
                savedImageBoards={savedImageBoards}
                selectedBoard={selectedBoard}
                setSelectedBoard={setSelectedBoard}
                selectedResearchBoard={selectedResearchBoard}
                setSelectedResearchBoard={setSelectedResearchBoard}
                selectedStyle={selectedStyle}
                onImageClick={setSelectedImage}
                onDownloadImage={handleDownloadImage}
                onDownloadAll={handleDownloadAll}
                onReviewForRegenerate={handleReviewForRegenerate}
                onDeleteResearch={handleDeleteResearch}
                onDeleteImages={handleDeleteImages}
                onDeleteSingleImage={handleDeleteSingleImage}
                onAddMoreSlides={handleAddMoreSlides}
                onUpdateResearch={handleUpdateResearch}
            />
        );
    };

    return (
        <div className="create-page">
            <Sidebar
                topic={topic}
                setTopic={setTopic}
                numSlides={numSlides}
                setNumSlides={setNumSlides}
                selectedStyle={selectedStyle}
                setSelectedStyle={setSelectedStyle}
                customStyles={customStyles}
                setCustomStyles={setCustomStyles}
                imageSize={imageSize}
                setImageSize={setImageSize}
                imageProvider={imageProvider}
                setImageProvider={setImageProvider}
                llmProvider={llmProvider}
                setLlmProvider={setLlmProvider}
                inputMode={inputMode}
                setInputMode={setInputMode}
                pastedText={pastedText}
                setPastedText={setPastedText}
                isGenerating={isGenerating}
                generatingPhase={generatingPhase}
                storyPlan={storyPlan}
                setStoryPlan={setStoryPlan}
                currentGeneratingSlide={currentGeneratingSlide}
                expectedSlides={expectedSlides}
                onGenerate={handleGenerate}
                onCancel={handleCancel}
                brands={brands}
                selectedBrand={selectedBrand}
                setSelectedBrand={setSelectedBrand}
                providerStatus={providerStatus}
            />

            {!isGenerating && (
                <ResearchPanel
                    completedResearch={completedResearch}
                    setCompletedResearch={setCompletedResearch}
                    researchCollapsed={researchCollapsed}
                    setResearchCollapsed={setResearchCollapsed}
                    onRegenerateImages={handleRegenerateImages}
                />
            )}

            <main className="main-content">
                {renderMainContent()}
            </main>

            <Lightbox
                selectedImage={selectedImage}
                setSelectedImage={setSelectedImage}
                generatedImages={generatedImages}
                generatedSlides={generatedSlides}
                storyCaption={storyCaption}
                storyHashtags={storyHashtags}
                topic={topic}
                onDownloadImage={handleDownloadImage}
            />
        </div>
    );
}

export default Create;
